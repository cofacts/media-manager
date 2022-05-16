import fetch from 'node-fetch';
import { MediaType } from '../types';

type PrepareStreamInput = {
  url: string;
};

type PrepareStreamResult = {
  /** Parsed media type */
  type: MediaType;

  /** Body stream */
  body: NodeJS.ReadableStream;
};

async function prepareStream({ url }: PrepareStreamInput): Promise<PrepareStreamResult> {
  const resp = await fetch(url);

  if (!resp.body) throw new Error(`No body is returned from ${url}`);

  const contentTypeBeforeSlash = (resp.headers.get('content-type') || '')
    .split('/')[0]
    .toLowerCase();
  if (!contentTypeBeforeSlash) throw new Error(`No content type header provided by ${url}`);

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
    body: resp.body,
  };
}

export default prepareStream;
