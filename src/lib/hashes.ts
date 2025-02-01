import { createHash } from 'crypto';
import sharp from 'sharp';
import { imageHash } from 'image-hash';
import contentType from 'content-type';

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

// The content types supported by image-hash
const SUPPORTED_CONTENT_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// A callback for attaching sharp chained methods
type SharpProcessor = (s: sharp.Sharp) => sharp.Sharp;

/**
 * Consumes image stream and calculate its ID hash
 *
 * @param fullBodyStream - Stream for file body
 * @param fileSize - number of bytes of the content
 * @parma contentType - Content-type header of the fullBodyStream
 */
export async function getImageSearchHashes(
  fullBodyStream: NodeJS.ReadableStream,
  fileSize: number,
  contentTypeStr: string
): Promise<ReadonlyArray<string>> {
  let ext = contentType.parse(contentTypeStr).type;

  const sharpProcessors: SharpProcessor[] = [];

  if (fileSize > IMAGE_RESIZE_THRESHOLD) {
    sharpProcessors.push(sharp =>
      sharp.resize({
        width: RESIZED_IMAGE_DIMENSION,
        height: RESIZED_IMAGE_DIMENSION,
        fit: 'inside',
      })
    );
  }

  // Convert to webp if original image format is not supported by image-hash
  if (!SUPPORTED_CONTENT_TYPES.includes(ext)) {
    ext = 'image/webp';
    sharpProcessors.push(sharp => sharp.webp({ lossless: true }));
  }

  // Buffer for the image
  const imageBuffer = await new Promise<Buffer>((resolve, reject) => {
    const stream =
      sharpProcessors.length === 0
        ? fullBodyStream
        : fullBodyStream.pipe(
            sharpProcessors.reduce((sharp, processor) => processor(sharp), sharp())
          );
    const chunks: Uint8Array[] = [];
    stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

  return Promise.all([imageHashAsync(imageBuffer, ext, 6), imageHashAsync(imageBuffer, ext, 16)]);
}

function imageHashAsync(buffer: Buffer, ext: string, bits: number): Promise<string> {
  return new Promise((resolve, reject) => {
    imageHash({ data: buffer, ext }, bits, true, (error: Error | null, data: string): void => {
      /* istanbul ignore if */
      if (error) {
        error.message = `[getImageSearchHashes][imageHash] ${error.message}`;
        reject(error);
      } else {
        resolve(Buffer.from(data, 'hex').toString('base64url'));
      }
    });
  });
}

/**
 * Number of bit 1 in half-byte (0~F)
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
