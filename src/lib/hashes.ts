import { createHash } from 'crypto';

/**
 * Consumes stream and calculate Non-image File ID hash.
 *
 * @param fullBodyStream Stream for file body
 */
export function getFileIDHash(fullBodyStream: NodeJS.ReadableStream): Promise<string> {
  const hash = createHash('sha256').setEncoding('base64');
  const stream = fullBodyStream.pipe(hash);

  return new Promise((resolve, reject) => {
    let idHash = '';
    stream.on('data', chunk => (idHash += chunk));
    stream.on('end', () => resolve(idHash));
    stream.on('error', reject);
  });
}

/**
 * Consumes image stream and calculate its ID hash
 *
 * @param resizedStream Stream for image body, which should be small enough to fit into memory
 */
export function getImageSearchHash(): Promise<string> {
  return new Promise(resolve => resolve(''));
}
