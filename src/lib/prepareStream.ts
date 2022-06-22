import fetch from 'node-fetch';
import { MediaType } from '../types';

type PrepareStreamInput = {
  url: string;
};

type PrepareStreamResult = {
  /** Parsed media type */
  type: MediaType;

  /** Original content type from url */
  contentType: string;

  /** File size in byte, read from Content-Length */
  size: number;

  /**
   * body stream from response.
   */
  body: NodeJS.ReadableStream;
};

async function prepareStream({ url }: PrepareStreamInput): Promise<PrepareStreamResult> {
  const resp = await fetch(url);

  const contentType = resp.headers.get('content-type') || '';
  const contentTypeBeforeSlash = contentType.split('/')[0].toLowerCase();

  if (!contentTypeBeforeSlash) throw new Error(`No content type header provided by ${url}`);

  const size = +(resp.headers.get('content-length') ?? 0);
  if (size === 0) throw new Error(`No content-length provided by ${url}, or content-length is 0`);

  let type: MediaType;
  switch (contentTypeBeforeSlash) {
    case 'image':
    case 'audio':
    case 'video':
      type = MediaType[contentTypeBeforeSlash];
      break;
    default:
      type = MediaType.file;
  }

  return {
    type,
    contentType,
    size,
    body: resp.body,
  };
}

export default prepareStream;
