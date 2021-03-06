import { File } from '@google-cloud/storage';

export interface SearchResult {
  /** metadata for the queried file */
  queryInfo: QueryInfo;
  hits: SearchHit[];
}

export interface SearchHit {
  /** Similarity between 0 and 1 */
  similarity: number;
  /** Metadata for the found media entry */
  entry: MediaEntry;
}

export enum MediaType {
  image = 'image',
  audio = 'audio',
  video = 'video',
  file = 'file',
}

export function isMediaType(type: string): type is MediaType {
  switch (type) {
    case MediaType.image:
    case MediaType.audio:
    case MediaType.video:
    case MediaType.file:
      return true;
    default:
      return false;
  }
}

/**
 * A media file entry representing one file uploaded via {@link MediaManager.insert}.
 * It maps to a directory on GCS hosting different variant of the uploaded file.
 */
export interface MediaEntry {
  /**
   * The unique ID for the media entry.
   * The ID is considered opaque;
   * Applications should not try to decipher this ID. */
  id: string;

  type: MediaType;

  /** Variants that exist on GCS for this media entry */
  variants: string[];

  /** Variant file's public URL. Defaults to get original variant. */
  getUrl: (variant?: string) => string;

  /** Variant file's GCS File object. Defaults to get original variant. */
  getFile: (variant?: string) => File;
}

/** ID is the to-be ID if the file is being inserted into database. */
export type QueryInfo = Pick<MediaEntry, 'id' | 'type'>;

export type MediaManagerOptions = {
  /** Google cloud credentail JSON content of a service account.
   * Must include keys:
   * - `project_id`
   * - `private_key`
   * - `client_email`
   */
  credentialsJSON: string;

  /**
   * Existing GCS bucket. The service account of `credentialsJSON` needs to
   * have the following permission of this bucket:
   * - `roles/storage.objectCreator`
   * - `roles/storage.objectViewer`
   */
  bucketName: string;

  /**
   * The prefix to write media files.
   * File structure after this prefix is managed by {@link MediaManager}
   */
  prefix?: string;

  /**
   * Specify the variant settings for each media file being uploaded.
   * If not given, only 1 variant, `original`, will be provided for all file types.
   */
  getVariantSettings?: GetVariantSettingsFn;
};

export type QueryOptions = {
  /**
   * The URL to the file to search for.
   * It is expected that the URL is:
   * - accessible
   * - has correct Content-Type header
   * - has correct Content-Length header
   */
  url: string;
};

export type InsertOptions = {
  /**
   * @see {@link QueryOptions.url}
   */
  url: string;

  /**
   * When upload succeeded, onUploadStop(null) will be called.
   * By this time, returned {@link MediaEntry.getUrl} should be usable.
   *
   * If upload fails, onUploadStop(err) will be called, passing the err returned by GCS NodeJS API.
   * If the file already exist, onUploadStop(err) will also be called with an error.
   */
  onUploadStop?: (err: Error | null) => void;

  /**
   * If given, getVariantSettings() settings in constructor is overridden.
   * Specifies variant settings for this specific insert operation.
   */
  getVariantSettings?: GetVariantSettingsFn;
};

/**
 * Information needed to uniquely identify a media entry (directory)
 */
export type MediaEntryIdentifier = {
  /** MediaType of the file */
  type: MediaType;

  /** Levels of multi-layer hash.
   *  For images, there are 2 layers; for others there is 1
   */
  hashes: ReadonlyArray<string>;
};

/**
 * Information needed to uniquely identify a file
 */
export type MediaFileIdentifier = MediaEntryIdentifier & {
  /**
   * @see {@link VariantSetting.name}
   */
  variant: string;
};

export type GetVariantSettingsOptions = {
  /** Parsed media type */
  type: MediaType;

  /** Original content type from url */
  contentType: string;

  /** File size in byte, read from Content-Length */
  size: number;
};

export type VariantSetting = {
  /** The name of variant. Maps to file name under the media entry directory. */
  name: string;

  /** The transform stream that takes file from input stream and outputs the variant file. */
  transform: NodeJS.ReadWriteStream;

  /** The content type of the transform output of this variant. */
  contentType: string;
};

/**
 * Given info about the file to upload,
 * returns the settings to the  available variants for the file.
 */
export type GetVariantSettingsFn = (opt: GetVariantSettingsOptions) => VariantSetting[];
