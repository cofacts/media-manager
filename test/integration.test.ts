import path from 'path';
import http from 'http';
import handler from 'serve-handler';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import { Storage } from '@google-cloud/storage';

import MediaManager from '../src/MediaManager';
import { MediaEntry, MediaType } from '../src/types';

require('dotenv').config();

if (process.env.CREDENTIALS_JSON && process.env.BUCKET_NAME) {
  const mediaManager = new MediaManager({
    credentialsJSON: process.env.CREDENTIALS_JSON,
    bucketName: process.env.BUCKET_NAME,
    prefix: process.env.PREFIX,
  });

  // File server serving test input file in ./fixtures
  //
  const server = http.createServer((req, res) =>
    handler(req, res, {
      public: path.join(__dirname, 'fixtures'),
    })
  );
  server.on('error', console.error);
  let serverUrl = '';

  // GCS bucket
  const credentials = JSON.parse(process.env.CREDENTIALS_JSON || '{}');
  const storage = new Storage({
    projectId: credentials.project_id,
    credentials,
  });
  const bucket = storage.bucket(process.env.BUCKET_NAME);

  beforeAll(async () => {
    // Clear bucket
    const prefix = process.env.PREFIX;
    await bucket.deleteFiles({ prefix });
    console.info(
      `[Integration] all files${!prefix ? '' : ` under prefix “${prefix}”`} in bucket “${
        bucket.name
      }” are deleted.`
    );

    // Start up file server
    serverUrl = await new Promise((resolve, reject) => {
      server.listen(() => {
        const addr = server.address();
        if (typeof addr === 'string' || addr === null) {
          return reject(`server.listen return wrong address: ${addr}`);
        }
        resolve(`http://localhost:${addr.port}`);
      });
    });

    console.info(`[Integration] file server listening at ${serverUrl}`);
  }, 10000);

  afterAll(async () => {
    // File server teardown
    await new Promise(resolve => server.close(resolve));
    console.info(`[Integration] file server closed.`);
  });

  it('can upload and query txt file', async () => {
    const testFileUrl = `${serverUrl}/100k.txt`;
    let uploadInfo: MediaEntry = { id: '', type: MediaType.file, getUrl: () => '', variants: [] };

    // First upload.
    // Resolves on upload complete.
    //
    const uploadError = await new Promise(async resolve => {
      uploadInfo = await mediaManager.insert({
        url: testFileUrl,
        onUploadStop: resolve,
      });

      expect(uploadInfo.id).toMatchInlineSnapshot(
        `"file.Dmqp3Bl7QD7dodKFpPLZss1ez1ef8CHg3oy9M7qndAU"`
      );
      expect(uploadInfo.type).toBe('file');
    });

    expect(uploadError).toBe(null);

    const originalFile = await fs.readFile(path.join(__dirname, 'fixtures', '100k.txt'), 'utf8');

    // Check if user can get identical file and expected content-type from returned URL
    //
    const resp = await fetch(uploadInfo.getUrl('original'));
    expect(resp.headers.get('Content-Type')).toMatchInlineSnapshot(`"text/plain; charset=utf-8"`);
    const fileViaUrl = await resp.text();
    expect(fileViaUrl).toEqual(originalFile);

    // Check getContent
    //
    const fileViaGetContent = await new Promise(resolve => {
      let result = '';
      mediaManager
        .getContent(uploadInfo.id, 'original')
        .on('data', chunk => (result += chunk))
        .on('close', () => resolve(result));
    });
    expect(fileViaGetContent).toEqual(originalFile);

    // Check if getInfo is identical to uploadInfo
    //
    const infoViaGetInfo = await mediaManager.getInfo(uploadInfo.id);
    expect(JSON.stringify(infoViaGetInfo)).toEqual(JSON.stringify(uploadInfo));

    // Check if query result returns the uploaded file
    const queryResult = await mediaManager.query({ url: testFileUrl });
    expect(queryResult).toHaveProperty(['queryInfo', 'id'], uploadInfo.id);
    expect(queryResult.hits).toHaveLength(1);
    expect(queryResult).toHaveProperty(['hits', 0, 'similarity'], 1);
    expect(queryResult).toHaveProperty(['hits', 0, 'info', 'id'], uploadInfo.id);

    // Test uploading duplicate file
    //
    const reuploadError = await new Promise(async resolve => {
      const info = await mediaManager.insert({
        url: testFileUrl,
        onUploadStop: resolve,
      });

      // Expect returned info are totally identical to the first upload
      expect(JSON.stringify(info)).toEqual(JSON.stringify(uploadInfo));
    });

    // Expect file already exists error
    expect(reuploadError).toMatchInlineSnapshot(
      `[Error: File with type=file and idHash="Dmqp3Bl7QD7dodKFpPLZss1ez1ef8CHg3oy9M7qndAU" already exists]`
    );
  }, 30000);

  it('can upload and query image file', async () => {
    let uploadInfo: MediaEntry = { id: '', type: MediaType.file, getUrl: () => '', variants: [] };

    // Resolves on upload complete.
    //
    const uploadError = await new Promise(async resolve => {
      uploadInfo = await mediaManager.insert({
        url: `${serverUrl}/small.jpg`,
        onUploadStop: resolve,
      });

      expect(uploadInfo.id).toMatchInlineSnapshot(
        `"image.vDph4g.__-AD6SDgAebG8cbwifBB-Dj0yPjo8ETgAOAA4P_8_8"`
      );
      expect(uploadInfo.type).toBe('image');
    });

    expect(uploadError).toBe(null);

    // Check if can query via similar image
    const queryResult = await mediaManager.query({ url: `${serverUrl}/small-similar.jpg` });
    expect(queryResult).toMatchInlineSnapshot(`
      Object {
        "hits": Array [
          Object {
            "info": Object {
              "getUrl": [Function],
              "id": "image.vDph4g.__-AD6SDgAebG8cbwifBB-Dj0yPjo8ETgAOAA4P_8_8",
              "type": "image",
              "variants": Array [
                "original",
              ],
            },
            "similarity": 0.9765625,
          },
        ],
        "queryInfo": Object {
          "id": "image.vDph4g.n_-AD4aDgB-bG8cbwifBB-Dj0yPjo8ETgAOAA4P_8_8",
          "type": "image",
        },
      }
    `);
  }, 30000);
}
