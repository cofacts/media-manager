export interface SearchResult {
  /** metadata for the queried file */
  queryInfo: QueryInfo;
  hits: SearchHit[];
}

export interface SearchHit {
  /** Similarity between 0 and 1 */
  similarity: number;
  /** Metadata for the file */
  info: FileInfo;
}

export enum MediaType {
  image = 'image',
  audio = 'audio',
  video = 'video',
  file = 'file',
}

export interface FileInfo {
  /**
   * The unique ID for the file.
   * The ID is considered opaque;
   * Applications should not try to decipher this ID. */
  id: string;

  /** Original file public URL */
  url: string;

  type: MediaType;
  // createdAt: Date;
}

/** ID is the to-be ID if the file is being inserted into database. */
export type QueryInfo = Pick<FileInfo, 'id' | 'type'>;

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
   * By this time, returned {@link FileInfo.url} should be usable.
   *
   * If upload fails, onUploadStop(err) will be called, passing the err returned by GCS NodeJS API.
   * If the file already exist, onUploadStop(err) will also be called with an error.
   */
  onUploadStop?: (err: Error | null) => void;
};
