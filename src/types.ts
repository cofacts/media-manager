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
   * If upload fails, onUploadStop(err) will be called, passing the err returned by GCS NodeJS API.
   */
  onUploadStop?: (err: Error | null) => void;
};
