import { Bucket, Storage } from '@google-cloud/storage';
import prepareStream from './lib/prepareStream';
import { getFileIDHash } from './lib/hashes';
import { SearchResult, FileInfo, MediaType } from './types';

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
    const { project_id: projectId, credentials } = JSON.parse(params.credentialsJSON || '{}');
    const storage = new Storage({ projectId, credentials });
    this.bucket = storage.bucket(params.bucketName || 'default');
    this.prefix = params.prefix ?? '';
  }

  // The GCS Bucket object
  private bucket: Bucket;
  private prefix: string;

  async query({ url }: { url: string }): Promise<SearchResult> {
    const { body, type } = await prepareStream({ url });
    // if (type !== MediaType.image) {
    const idHash = getFileIDHash(body);
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

  // insert({ url: string }): Promise<FileInfo> {}

  // Get file by ID from GCS
  // getContent(id: string): ReadableStream {}

  // Get file info by ID from GCS. Null if specified ID does not exist.
  // getInfo(id: string): FileInfo | null {}
}

export default MediaManager;
