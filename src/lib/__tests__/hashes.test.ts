import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { getFileIDHash, getImageSearchHashes, base64urlHammingDist } from '../hashes';

describe('getFileIDHash', () => {
  it('generates hash', async () => {
    const infileStream = fs.createReadStream(
      path.resolve(__dirname, '../../../test/fixtures/100k.txt')
    );

    await expect(getFileIDHash(infileStream)).resolves.toMatchInlineSnapshot(
      `"Dmqp3Bl7QD7dodKFpPLZss1ez1ef8CHg3oy9M7qndAU"`
    );
  });

  it('rejects on stream error', () => {
    const readable = new Readable({ read() {} });
    // Connect pipe by executing getFileIDHash(readable) first
    const expectPromise = expect(getFileIDHash(readable)).rejects.toMatchInlineSnapshot(
      `[Error: test error]`
    );

    // Then trigger error
    readable.emit('error', new Error('test error'));

    // Make sure test ends after promise rejects
    return expectPromise;
  });
});

describe('getImageSearchHashes', () => {
  it('generates hashes for small file', async () => {
    const smallImage = path.resolve(__dirname, '../../../test/fixtures/small.jpg');
    const infileStream = fs.createReadStream(smallImage);
    const { size } = fs.statSync(smallImage);

    await expect(getImageSearchHashes(infileStream, size)).resolves.toMatchInlineSnapshot(`
            Array [
              "vDph4g",
              "__-AD6SDgAebG8cbwifBB-Dj0yPjo8ETgAOAA4P_8_8",
            ]
          `);
  });

  // it('generates hashes for large file')
});

describe('base64urlHammingDist', () => {
  it('calculates hamming distance', () => {
    expect(
      base64urlHammingDist(
        Buffer.from('00ff00', 'hex').toString('base64url'),
        Buffer.from('00ff00', 'hex').toString('base64url')
      )
    ).toBe(0);

    expect(
      base64urlHammingDist(
        // 0001 0010 0011 0100 0101 0110 0111 1000
        Buffer.from('12345678', 'hex').toString('base64url'),
        // 0000 0011 0010 0101 0100 0111 0110 1001
        Buffer.from('03254769', 'hex').toString('base64url')
      )
    ).toBe(8);

    expect(
      base64urlHammingDist(
        // 0000 0010 0111 1111
        Buffer.from('027f', 'hex').toString('base64url'),
        // 1111 1101 1000 0000
        Buffer.from('fd80', 'hex').toString('base64url')
      )
    ).toBe(16);
  });
});
