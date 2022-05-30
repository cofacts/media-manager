import { Bucket, Storage } from '@google-cloud/storage';
import { pipeline } from 'stream/promises';
import prepareStream from './lib/prepareStream';
import { getFileIDHash, getImageSearchHashes, base64urlHammingDist } from './lib/hashes';
import {
  SearchResult,
  FileInfo,
  isMediaType,
  QueryOptions,
  InsertOptions,
  MediaManagerOptions,
  FileIdentifier,
  MediaType,
} from './types';

// URL-safe delimiter for file ID components
const ID_DELIMITER = '.';

class MediaManager {
  constructor(params: MediaManagerOptions) {
    const { project_id: projectId, ...credentials } = JSON.parse(params.credentialsJSON || '{}');
    const storage = new Storage({ projectId, credentials });
    this.bucket = storage.bucket(params.bucketName || 'default');
    this.prefix = params.prefix ?? '';
  }

  // The GCS Bucket object
  private bucket: Bucket;
  private prefix: string;

  /**
   * @param type - MediaType of the file
   * @param hashes - Levels of multi-layer hash (for images, there are 2 layers; for others there is 1).
   * @returns File name on GCS
   */
  private genFileName({ type, hashes }: FileIdentifier): string {
    return `${this.prefix}${type}/${hashes.join('/')}`;
  }

  /**
   * @param name - File name on GCS
   * @returns
   */
  private parseFilename(name: string): FileIdentifier {
    if (this.prefix) name = name.slice(this.prefix.length);
    const [type, ...hashes] = name.split('/');

    if (isMediaType(type)) return { type, hashes };
    throw new Error(`Incorrect file name: ${name}`);
  }

  /**
   * @returns `id` in {@link FileInfo.id FileInfo}
   */
  private genId({ type, hashes }: FileIdentifier) {
    return [type, ...hashes].join(ID_DELIMITER);
  }

  /**
   * @param id - `id` in {@link FileInfo.id FileInfo}
   */
  private parseId(id: string): FileIdentifier {
    const [type, ...hashes] = id.split(ID_DELIMITER);

    if (isMediaType(type) && hashes.length > 0) return { type, hashes };
    throw new Error(`Incorrect ID: ${id}`);
  }

  async query({ url }: QueryOptions): Promise<SearchResult> {
    const { body, type, size } = await prepareStream({ url });

    const hashes =
      type === MediaType.image
        ? await getImageSearchHashes(body, size)
        : [await getFileIDHash(body)];

    // Only use first hash as search hash, no matter it's image or file
    const prefix = this.genFileName({ type, hashes: [hashes[0]] });

    const [files] = await this.bucket.getFiles({ prefix });

    return {
      queryInfo: { id: this.genId({ type, hashes }), type },
      hits: files
        .map(file => {
          const info = {
            id: this.genId(this.parseFilename(file.name)),
            url: file.publicUrl(),
            type,
          };

          if (type !== MediaType.image) return { similarity: 1, info };

          // Image: calculate similarity between id hash of query and id hash of found file
          const {
            hashes: [, foundIdHash],
          } = this.parseFilename(file.name);
          const similarity = 1 - base64urlHammingDist(foundIdHash, hashes[1]) / 256;

          return { similarity, info };
        })
        .sort((a, b) => b?.similarity - a.similarity),
    };
  }

  async insert({ url, onUploadStop }: InsertOptions): Promise<FileInfo> {
    const { body, type, contentType, size } = await prepareStream({ url });

    // Temporary file name used when uploading the data before idHash is calculated
    //
    const tempFileName = `${Date.now()}_${Math.floor(Math.random() * 9999.9)
      .toString()
      .padStart(4, '0')}`;

    const tempFile = this.bucket.file(`${this.prefix}temp/${tempFileName}`);

    // Must not await this promise because we still need to pipe body to another writable stream
    // for hash calculation below
    const uploadPromise = pipeline(body, tempFile.createWriteStream({ contentType }));

    uploadPromise.catch(error => {
      if (onUploadStop) onUploadStop(error);
    });

    const hashes =
      type === MediaType.image
        ? await getImageSearchHashes(body, size)
        : [await getFileIDHash(body)];

    const destFile = this.bucket.file(this.genFileName({ type, hashes }));

    // Rename temp file after id hash is generated.
    //
    const [isDestFileExists] = await destFile.exists();
    if (isDestFileExists) {
      if (onUploadStop)
        // Invoke onUploadStop early (even though the actual upload may still in progress)
        onUploadStop(
          new Error(`File with type=${type} and idHash="${hashes.join('/')}" already exists`)
        );

      // tempFile can be safely accessed only after uploadPromise resolves.
      // No need to await.
      uploadPromise.then(() => tempFile.delete());
    } else {
      // Move file to destination after fully uploaded.
      // No need to await.
      uploadPromise
        .then(() => tempFile.move(destFile))
        .then(() => {
          // After move completes, call onUploadStop with no errors
          if (onUploadStop) onUploadStop(null);
        });
    }

    return {
      id: this.genId({ type, hashes }),
      type,
      url: destFile.publicUrl(),
    };
  }

  // Get file by ID from GCS
  getContent(id: string): NodeJS.ReadableStream {
    const file = this.bucket.file(this.genFileName(this.parseId(id)));
    return file.createReadStream();
  }

  // Get file info by ID from GCS. Null if specified ID does not exist.
  async getInfo(id: string): Promise<FileInfo | null> {
    const { type, hashes } = this.parseId(id);
    const file = this.bucket.file(this.genFileName({ type, hashes }));

    const [isFileExists] = await file.exists();

    return !isFileExists
      ? null
      : {
          id,
          url: file.publicUrl(),
          type,
        };
  }
}

export default MediaManager;
