import path from 'path';
import http from 'http';
import handler from 'serve-handler';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';

// Get from public API
import { MediaManager, MediaEntry, variants } from '../src/';

require('dotenv').config();

if (process.env.CREDENTIALS_JSON && process.env.BUCKET_NAME) {
  const credentialsJSON = process.env.CREDENTIALS_JSON;
  const bucketName = process.env.BUCKET_NAME;

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
    const mediaManager = new MediaManager({
      credentialsJSON,
      bucketName,
      prefix: process.env.PREFIX,
    });

    const testFileUrl = `${serverUrl}/100k.txt`;
    let insertedEntry: MediaEntry | undefined;

    // First upload.
    // Resolves on upload complete.
    //
    const uploadError = await new Promise(async resolve => {
      insertedEntry = await mediaManager.insert({
        url: testFileUrl,
        onUploadStop: resolve,
      });

      expect(insertedEntry.id).toMatchInlineSnapshot(
        `"file.Dmqp3Bl7QD7dodKFpPLZss1ez1ef8CHg3oy9M7qndAU"`
      );
      expect(insertedEntry.type).toBe('file');
    });

    expect(uploadError).toBe(null);

    const originalFile = await fs.readFile(path.join(__dirname, 'fixtures', '100k.txt'), 'utf8');

    /* istanbul ignore if */
    if (!insertedEntry) throw new Error('insertEntry should be assigned');

    // Check if user can get identical file and expected content-type from returned URL
    //
    const insertedEntryUrl = insertedEntry.getUrl();
    const resp = await fetch(insertedEntryUrl);
    expect(resp.headers.get('Content-Type')).toMatchInlineSnapshot(`"text/plain; charset=utf-8"`);
    const fileViaUrl = await resp.text();
    expect(fileViaUrl).toEqual(originalFile);

    // Check getContent
    //
    const insertedEntryId = insertedEntry.id; // insertedEntry is not narrowed in callbacks...
    const fileViaGetContent = await new Promise(resolve => {
      let result = '';
      mediaManager
        .getContent(insertedEntryId, 'original')
        .on('data', chunk => (result += chunk))
        .on('close', () => resolve(result));
    });
    expect(fileViaGetContent).toEqual(originalFile);

    // Check if get entry is identical to inserted entry
    //
    const mediaEntry = await mediaManager.get(insertedEntry.id);
    expect(JSON.stringify(mediaEntry)).toEqual(JSON.stringify(insertedEntry));

    // Check not-exist variant
    expect(() => mediaEntry?.getUrl('notExistVariant')).toThrowErrorMatchingInlineSnapshot(
      `"Variant notExistVariant does not exist; available variants: original"`
    );
    // Check getFile
    expect(mediaEntry?.getFile('original').publicUrl()).toEqual(insertedEntryUrl);

    // Check if query result returns the uploaded file
    const queryResult = await mediaManager.query({ url: testFileUrl });
    expect(queryResult).toHaveProperty(['queryInfo', 'id'], insertedEntry.id);
    expect(queryResult.hits).toHaveLength(1);
    expect(queryResult).toHaveProperty(['hits', 0, 'similarity'], 1);
    expect(queryResult).toHaveProperty(['hits', 0, 'entry', 'id'], insertedEntry.id);

    // Test uploading duplicate file
    //
    const reuploadError = await new Promise(async resolve => {
      const entry = await mediaManager.insert({
        url: testFileUrl,
        onUploadStop: resolve,
      });

      // Expect returned info are totally identical to the first upload
      expect(JSON.stringify(entry)).toEqual(JSON.stringify(insertedEntry));
    });

    // Expect file already exists error
    expect(reuploadError).toMatchInlineSnapshot(
      `[Error: File with type=file and idHash="Dmqp3Bl7QD7dodKFpPLZss1ez1ef8CHg3oy9M7qndAU" already exists]`
    );
  }, 30000);

  it('can upload and query image file', async () => {
    const mediaManager = new MediaManager({
      credentialsJSON,
      bucketName,
      prefix: process.env.PREFIX,

      // Test custom getVariantSettings
      //
      getVariantSettings({ contentType }) {
        return [
          variants.original(contentType),
          {
            name: 'webp100w', // resize to width=100 and convert to webp
            contentType: 'image/webp',
            transform: sharp()
              .resize(100)
              .webp(),
          },
        ];
      },
    });

    // Resolves on upload complete.
    //
    const uploadError = await new Promise(async resolve => {
      const insertedEntry = await mediaManager.insert({
        url: `${serverUrl}/small.jpg`,
        onUploadStop: resolve,
      });

      expect(insertedEntry.id).toMatchInlineSnapshot(
        `"image.vDph4g.__-AD6SDgAebG8cbwifBB-Dj0yPjo8ETgAOAA4P_8_8"`
      );
      expect(insertedEntry.type).toBe('image');
    });

    expect(uploadError).toBe(null);

    // Check if can query via similar image
    const queryResult = await mediaManager.query({ url: `${serverUrl}/small-similar.jpg` });
    expect(queryResult).toMatchInlineSnapshot(`
      Object {
        "hits": Array [
          Object {
            "entry": Object {
              "getFile": [Function],
              "getUrl": [Function],
              "id": "image.vDph4g.__-AD6SDgAebG8cbwifBB-Dj0yPjo8ETgAOAA4P_8_8",
              "type": "image",
              "variants": Array [
                "original",
                "webp100w",
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

    // Check if can search by ID; should be identical to queryResult
    const queryResultById = await mediaManager.query({ id: queryResult.queryInfo.id });
    expect(JSON.stringify(queryResultById)).toEqual(JSON.stringify(queryResult));
  }, 30000);
}
