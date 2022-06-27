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

export interface MediaEntry {
  /**
   * The unique ID for the media entry.
   * The ID is considered opaque;
   * Applications should not try to decipher this ID. */
  id: string;

  /** Variant file's public URL */
  getUrl: (variant: string) => string;

  type: MediaType;

  /** Available variants for this media entry */
  variants: string[];
  // createdAt: Date;
}

/** ID is the to-be ID if the file is being inserted into database. */
export type QueryInfo = Pick<MediaEntry, 'id' | 'type'>;

export type MediaManagerOptions = {
  /** Google cloud credentail JSON content of a service account.
   * Must include keys:
   * - project_id
   * - private_key
   * - client_email
   */
  credentialsJSON: string;

  /**
   * Existing GCS bucket. The service account of `credentialsJSON` needs to
   * have the following permission of this bucket:
   * - roles/storage.objectCreator
   * - roles/storage.objectViewer
   */
  bucketName: string;

  /**
   * The prefix to write media files.
   * File structure after this prefix is managed by MediaManager
   */
  prefix?: string;
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
  variant: string;
};
