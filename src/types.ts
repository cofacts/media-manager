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
