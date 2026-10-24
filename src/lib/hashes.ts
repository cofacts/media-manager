import { createHash } from 'crypto';
import sharp from 'sharp';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import webp from '@cwasm/webp';
import contentType from 'content-type';
import { bmvbhash, ImageData } from './blockHash';

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

// The content types supported by decodeImage()
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

  // Convert to webp if original image format is not supported by decodeImage()
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

  let imageData: ImageData;
  try {
    imageData = decodeImage(imageBuffer, ext);
  } catch (error) /* istanbul ignore next */ {
    if (error instanceof Error) error.message = `[getImageSearchHashes][decode] ${error.message}`;
    throw error;
  }

  return [6, 16].map(bits => Buffer.from(bmvbhash(imageData, bits), 'hex').toString('base64url'));
}

/**
 * Decodes image into RGBA pixels, using the same decoders as image-hash so that hashes stay the same.
 */
function decodeImage(buffer: Buffer, ext: string): ImageData {
  switch (ext) {
    case 'image/png':
      return PNG.sync.read(buffer);
    case 'image/jpeg':
    case 'image/jpg':
      return jpeg.decode(buffer);
    case 'image/webp':
      return webp.decode(new Uint8Array(buffer));
    /* istanbul ignore next */
    default:
      throw new Error(`Unrecognized mime type: ${ext}`);
  }
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
