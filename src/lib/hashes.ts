import { createHash } from 'crypto';
import sharp from 'sharp';
import { imageHash } from 'image-hash';

/**
 * Consumes stream and calculate Non-image File ID hash.
 *
 * @param fullBodyStream - Stream for file body
 */
export function getFileIDHash(fullBodyStream: NodeJS.ReadableStream): Promise<string> {
  const hash = createHash('sha256').setEncoding('base64url');

  return new Promise((resolve, reject) => {
    fullBodyStream.on('error', reject);

    let idHash = '';
    fullBodyStream
      .pipe(hash)
      .on('data', chunk => (idHash += chunk))
      .on('end', () => resolve(idHash))
      .on('error', reject);
  });
}

const IMAGE_RESIZE_THRESHOLD = 1024 * 1024; // 1MB
const RESIZED_IMAGE_DIMENSION = 1024; // Max image size = square(RESIZED_IMAGE_DIMENSION)

/**
 * Consumes image stream and calculate its ID hash
 *
 * @param fullBodyStream - Stream for file body
 * @param fileSize - number of bytes of the content
 */
export async function getImageSearchHashes(
  fullBodyStream: NodeJS.ReadableStream,
  fileSize: number
): Promise<ReadonlyArray<string>> {
  // Buffer for the image; if image too large, it is compressed
  const imageBuffer = await new Promise<Buffer>((resolve, reject) => {
    const stream =
      fileSize <= IMAGE_RESIZE_THRESHOLD
        ? fullBodyStream
        : fullBodyStream.on('error', reject).pipe(
            sharp().resize({
              width: RESIZED_IMAGE_DIMENSION,
              height: RESIZED_IMAGE_DIMENSION,
              fit: 'inside',
            })
          );

    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

  return Promise.all([imageHashAsync(imageBuffer, 6), imageHashAsync(imageBuffer, 16)]);
}

function imageHashAsync(buffer: Buffer, bits: number): Promise<string> {
  return new Promise((resolve, reject) => {
    imageHash({ data: buffer }, bits, true, (error: Error | null, data: string): void => {
      /* istanbul ignore if */
      if (error) {
        reject(error);
      } else {
        resolve(Buffer.from(data, 'hex').toString('base64url'));
      }
    });
  });
}

/**
 * Number of bit 1 in a byte
 */
const numOf1inHalfByte = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/**
 * Return the hamming distance between the two base64url encoded hash
 */
export function base64urlHammingDist(hashA: string, hashB: string): number {
  const bufferA = Buffer.from(hashA, 'base64url');
  const bufferB = Buffer.from(hashB, 'base64url');

  let hammingDist = 0;
  for (let i = 0; i < bufferA.length; i += 1) {
    const xor = bufferA[i] ^ bufferB[i];

    hammingDist +=
      numOf1inHalfByte[(xor & 240) /* F0 */ >> 4] + numOf1inHalfByte[xor & 15 /* 0F */];
  }

  return hammingDist;
}
