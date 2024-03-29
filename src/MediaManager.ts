import fetch from 'node-fetch';
import { Bucket, Storage, File } from '@google-cloud/storage';
import prepareStream from './lib/prepareStream';
import { defaultGetVariantSettings, DEFAULT_ORIGINAL_VARIANT_NAME } from './lib/variants';
import { getFileIDHash, getImageSearchHashes, base64urlHammingDist } from './lib/hashes';
import {
  SearchResult,
  MediaEntry,
  isMediaType,
  QueryOptions,
  InsertOptions,
  MediaManagerOptions,
  MediaEntryIdentifier,
  MediaFileIdentifier,
  MediaType,
  GetVariantSettingsFn,
} from './types';

// URL-safe delimiter for file ID components
const ID_DELIMITER = '.';

class MediaManager {
  constructor(params: MediaManagerOptions) {
    const { project_id: projectId, ...credentials } = JSON.parse(params.credentialsJSON || '{}');
    const storage = new Storage({ projectId, credentials });
    this.bucket = storage.bucket(params.bucketName || 'default');
    this.prefix = params.prefix ?? '';
    this.getVariantSettingsFn = params.getVariantSettings ?? defaultGetVariantSettings;
  }

  // The GCS Bucket object
  private bucket: Bucket;
  private prefix: string;
  private getVariantSettingsFn: GetVariantSettingsFn;

  /**
   * @param mediaEntry - Identifier of a directory on GCS, including media type and its hashes
   * @returns Media entry (diretory name) on GCS
   */
  private genMediaEntryName({ type, hashes }: MediaEntryIdentifier): string {
    return `${this.prefix}${type}/${hashes.join('/')}`;
  }

  /**
   * @param fileIdentifier - Identifier to a file (media entry variant)
   * @returns File path on GCS
   */
  private genFileName({ variant, ...mediaEntryIdent }: MediaFileIdentifier): string {
    return `${this.genMediaEntryName(mediaEntryIdent)}/${variant}`;
  }

  /**
   * @param name - File name on GCS
   * @returns Parsed identifier data
   */
  private parseFilename(name: string): MediaFileIdentifier {
    if (this.prefix) name = name.slice(this.prefix.length);
    const chunks = name.split('/');
    const [type, ...hashes] = chunks.slice(0, -1);
    const variant = chunks.at(-1);
    if (!variant) throw new Error(`No variant found in file name ${name}`);

    if (isMediaType(type)) return { type, hashes, variant };
    throw new Error(`Incorrect file name: ${name}`);
  }

  /**
   * @returns `id` in {@link MediaEntry.id MediaEntry}
   */
  private genId({ type, hashes }: MediaEntryIdentifier) {
    return [type, ...hashes].join(ID_DELIMITER);
  }

  /**
   * @param id - `id` in {@link MediaEntry.id MediaEntry}
   */
  private parseId(id: string): MediaEntryIdentifier {
    const [type, ...hashes] = id.split(ID_DELIMITER);

    if (isMediaType(type) && hashes.length > 0) return { type, hashes };
    throw new Error(`Incorrect ID: ${id}`);
  }

  /**
   * Generates media entry identifier for {@link MediaManager.query}'s argument.
   */
  private async processQueryOptions(opt: QueryOptions): Promise<MediaEntryIdentifier> {
    if ('id' in opt) return this.parseId(opt.id);

    const { body, type, contentType, size } = await prepareStream({ url: opt.url });
    const hashes =
      type === MediaType.image
        ? await getImageSearchHashes(body, size, contentType)
        : [await getFileIDHash(body)];
    return { type, hashes };
  }

  async query(options: QueryOptions): Promise<SearchResult> {
    const { type, hashes } = await this.processQueryOptions(options);

    // Only use first hash as search hash, no matter it's image or file
    const prefix = this.genMediaEntryName({ type, hashes: [hashes[0]] });

    const [files] = await this.bucket.getFiles({ prefix });

    const entryVariantMap = files.reduce<{ [entryId: string]: { [variant: string]: File } }>(
      (map, file) => {
        const { variant, ...mediaEntryIdent } = this.parseFilename(file.name);
        const id = this.genId(mediaEntryIdent);
        if (!map[id]) map[id] = {};
        map[id][variant] = file;
        return map;
      },
      {}
    );

    return {
      queryInfo: { id: this.genId({ type, hashes }), type },
      hits: Object.entries(entryVariantMap)
        .map(([id, variantMap]) => {
          const entry = {
            id,
            type,
            ...variantProps(variantMap),
          };

          if (type !== MediaType.image) return { similarity: 1, entry };

          // Image: calculate similarity between id hash of query and id hash of found file
          const {
            hashes: [, foundIdHash],
          } = this.parseId(id);
          const similarity = 1 - base64urlHammingDist(foundIdHash, hashes[1]) / 256;

          return { similarity, entry };
        })
        .sort((a, b) => b?.similarity - a.similarity),
    };
  }

  async insert({ url, onUploadStop, getVariantSettings }: InsertOptions): Promise<MediaEntry> {
    const { body, type, contentType, size } = await prepareStream({ url });

    const variantSettings = (getVariantSettings ?? this.getVariantSettingsFn)({
      type,
      contentType,
      size,
    });

    // Temporary file name used when uploading the data before idHash is calculated
    //
    const tempEntryName = `${Date.now()}_${Math.floor(Math.random() * 9999.9)
      .toString()
      .padStart(4, '0')}`;

    const tempVariantFiles = variantSettings.map(({ name }) =>
      this.bucket.file(`${this.prefix}temp/${tempEntryName}/${name}`)
    );

    // Must not await this promise because we still need to pipe body to another writable stream
    // for hash calculation below
    const uploadPromise = Promise.all(
      variantSettings.map(
        async ({ transform, contentType }, i) =>
          new Promise(async (resolve, reject) => {
            // Initiate separate HTTP stream here, as each variant may consume the stream differently,
            // or even ends before reading the whole file.
            (await fetch(url)).body
              .pipe(transform)
              .pipe(tempVariantFiles[i].createWriteStream({ contentType, gzip: 'auto' }))
              .on('finish', resolve)
              .on('error', reject);
          })
      )
    );

    uploadPromise.catch(error => {
      if (onUploadStop) onUploadStop(error);
    });

    const hashes =
      type === MediaType.image
        ? await getImageSearchHashes(body, size, contentType)
        : [await getFileIDHash(body)];

    const destVariantFiles = variantSettings.map(({ name }) =>
      this.bucket.file(this.genFileName({ type, hashes, variant: name }))
    );

    // Rename temp file after id hash is generated.
    //
    const [isDestFileExists] = await destVariantFiles[0].exists();
    if (isDestFileExists) {
      if (onUploadStop)
        // Invoke onUploadStop early (even though the actual upload may still in progress)
        onUploadStop(
          new Error(`File with type=${type} and idHash="${hashes.join('/')}" already exists`)
        );

      // tempFile can be safely accessed only after uploadPromise resolves.
      // No need to await.
      uploadPromise.then(() => tempVariantFiles.forEach(tempFile => tempFile.delete()));
    } else {
      // Move all variant files to destination after fully uploaded.
      // No need to await.
      uploadPromise
        .then(() =>
          Promise.all(tempVariantFiles.map((tempFile, i) => tempFile.move(destVariantFiles[i])))
        )
        .then(() => {
          // After move completes, call onUploadStop with no errors
          if (onUploadStop) onUploadStop(null);
        });
    }

    const destFileMap: { [variant: string]: File } = Object.fromEntries(
      variantSettings.map(({ name }, i) => [name, destVariantFiles[i]])
    );

    return {
      id: this.genId({ type, hashes }),
      type,
      ...variantProps(destFileMap),
    };
  }

  /**
   * @param id - `id` in {@link MediaEntry.id MediaEntry}
   * @returns The {@link MediaEntry MediaEntry}, or null if ID does not map to a media entry on GCS.
   */
  async get(id: string): Promise<MediaEntry | null> {
    const { type, hashes } = this.parseId(id);
    const prefix = this.genMediaEntryName({ type, hashes });
    const [files] = await this.bucket.getFiles({ prefix });

    if (files.length === 0) return null;

    const variantMap: { [variant: string]: File } = Object.fromEntries(
      files.map(file => {
        const { variant } = this.parseFilename(file.name);
        return [variant, file];
      })
    );

    return {
      id,
      type,
      ...variantProps(variantMap),
    };
  }

  /**
   * Returns the [GCS `File`](https://googleapis.dev/nodejs/storage/latest/File.html) for the specified
   * `id` and `variant`.
   *
   * Note that this API does not check if the file actually exist on GCS; you may
   * use the [`exists` method provided by GCS File](https://googleapis.dev/nodejs/storage/latest/File.html#exists) to check by yourself.
   *
   * @param id - `id` in {@link MediaEntry.id MediaEntry}
   * @param variant - Maps to {@link VariantSetting.name}. Defaults to `original`.
   */
  getFile(id: string, variant: string | undefined = DEFAULT_ORIGINAL_VARIANT_NAME): File {
    return this.bucket.file(this.genFileName({ ...this.parseId(id), variant }));
  }

  /**
   * @param id - `id` in {@link MediaEntry.id MediaEntry}
   * @param variant - Maps to {@link VariantSetting.name}. Defaults to `original`.
   * @returns a ReadableStream of file content from GCS.
   */
  getContent(
    id: string,
    variant: string | undefined = DEFAULT_ORIGINAL_VARIANT_NAME
  ): NodeJS.ReadableStream {
    return this.getFile(id, variant).createReadStream();
  }
}

function getVariantFileOrThrow(
  variantFileMap: {
    [variant: string]: File;
  },
  variant: string
): File {
  const file = variantFileMap[variant];
  if (!file) {
    const variants = Object.keys(variantFileMap);
    throw new Error(
      `Variant ${variant} does not exist; available variants: ${variants.join(', ')}`
    );
  }
  return file;
}

/**
 * Helpfer function that returns parts of MediaEntry that is generated from a map of variant to GCS file.
 *
 * @param variantFileMap - An object that maps {@link VariantSetting.name} to GCS File object.
 */
function variantProps(variantFileMap: {
  [variant: string]: File;
}): Pick<MediaEntry, 'variants' | 'getUrl' | 'getFile'> {
  return {
    variants: Object.keys(variantFileMap),
    getUrl(variant = DEFAULT_ORIGINAL_VARIANT_NAME) {
      return getVariantFileOrThrow(variantFileMap, variant).publicUrl();
    },
    getFile(variant = DEFAULT_ORIGINAL_VARIANT_NAME) {
      return getVariantFileOrThrow(variantFileMap, variant);
    },
  };
}

export default MediaManager;
