import { Bucket, Storage } from '@google-cloud/storage';
import { pipeline } from 'stream/promises';
import prepareStream from './lib/prepareStream';
import { getFileIDHash } from './lib/hashes';
import { SearchResult, FileInfo, MediaType, QueryOptions, InsertOptions } from './types';

// URL-safe delimiter for file ID components
const ID_DELIMITER = '.';

class MediaManager {
  constructor(params: {
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
  }) {
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
  private genFileName(type: MediaType, hashes: ReadonlyArray<string>): string {
    return `${this.prefix}/${type}/${hashes.join('/')}`;
  }

  /**
   * @param type - MediaType of the file
   * @param hashes - Levels of multi-layer hash (for images, there are 2 layers; for others there is 1).
   * @returns `id` in {@link FileInfo.id FileInfo}
   */
  private genId(type: MediaType, hashes: ReadonlyArray<string>) {
    return [type, ...hashes].join(ID_DELIMITER);
  }

  /**
   * @param id - `id` in {@link FileInfo.id FileInfo}
   * @returns File name on GCS
   */
  private parseId(id: string): { type: MediaType; hashes: string[] } {
    const [type, ...hashes] = id.split(ID_DELIMITER);
    switch (type) {
      case MediaType.image:
      case MediaType.audio:
      case MediaType.video:
      case MediaType.file:
        if (hashes.length > 0) {
          return { type, hashes };
        }

      // falls through
      default:
        throw new Error(`Incorrect ID: ${id}`);
    }
  }

  async query({ url }: QueryOptions): Promise<SearchResult> {
    const { body, type } = await prepareStream({ url });
    // if (type !== MediaType.image) {
    const idHash = await getFileIDHash(body);
    const id = [type, idHash].join('/');

    const [files] = await this.bucket.getFiles({ prefix: [this.prefix, id].join('/') });

    return {
      queryInfo: { id, type },
      hits: files.map(file => ({
        similarity: 1,
        info: {
          id: this.prefix ? file.name.slice(this.prefix.length + 1) : file.name,
          url: file.publicUrl(),
          type,
          // createdAt: file
        },
      })),
    };
    // }
  }

  async insert({ url, onUploadStop }: InsertOptions): Promise<FileInfo> {
    const { body, type, contentType, clone } = await prepareStream({ url });

    const tempFileName = `${Date.now()}_${Math.floor(Math.random() * 9999.9)
      .toString()
      .padStart(4, '0')}`;
    const file = this.bucket.file(`${this.prefix}${tempFileName}`);

    pipeline(clone(), file.createWriteStream({ contentType }))
      .then(() => {
        if (onUploadStop) onUploadStop(null);
      })
      .catch(error => {
        if (onUploadStop) onUploadStop(error);
      });

    const idHash = await getFileIDHash(body);
    await file.rename(this.genFileName(type, [idHash]));
    return {
      id: this.genId(type, [idHash]),
      url: file.publicUrl(),
      type,
    };
  }

  // Get file by ID from GCS
  // getContent(id: string): ReadableStream {}

  // Get file info by ID from GCS. Null if specified ID does not exist.
  async getInfo(id: string): Promise<FileInfo | null> {
    const { type, hashes } = this.parseId(id);
    const file = this.bucket.file(this.genFileName(type, hashes));

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
