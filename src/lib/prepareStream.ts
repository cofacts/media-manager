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

  /**
   * Returns latest body from response.
   * `clone()` may change original resp.body, so we must use accessor to ensure latest body
   * is fetched.
   * @see {@link https://github.com/node-fetch/node-fetch/blob/2.x/src/body.js#L409-L410}
   */
  getBody: () => NodeJS.ReadableStream;

  /**
   * Create and returns a cloned body stream.
   * Notice that each cloned stream must be consumed along with body stream.
   *
   * @see {@link(https://github.com/node-fetch/node-fetch#custom-highwatermark)}
   */
  clone: () => NodeJS.ReadableStream;
};

async function prepareStream({ url }: PrepareStreamInput): Promise<PrepareStreamResult> {
  const resp = await fetch(url);

  const contentType = resp.headers.get('content-type') || '';
  const contentTypeBeforeSlash = contentType.split('/')[0].toLowerCase();

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
    contentType,
    getBody: () => {
      if (!resp.body) throw new Error(`No body is returned from ${url}`);
      return resp.body;
    },
    clone: () => {
      const body = resp.clone().body;
      if (!body) throw new Error('Response stream clone failed');
      return body;
    },
  };
}

export default prepareStream;
