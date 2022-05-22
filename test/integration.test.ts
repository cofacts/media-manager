import path from 'path';
import http from 'http';
import handler from 'serve-handler';
import { Storage } from '@google-cloud/storage';

// import MediaManager from '../src/MediaManager';

require('dotenv').config();

if (process.env.CREDENTIALS_JSON && process.env.BUCKET_NAME) {
  // const mediaManager = new MediaManager({
  //   credentialsJSON: process.env.CREDENTIALS_JSON,
  //   bucketName: process.env.BUCKET_NAME,
  //   prefix: process.env.PREFIX,
  // });

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
  }, 30000);

  afterAll(async () => {
    // File server teardown
    await new Promise(resolve => server.close(resolve));
    console.info(`[Integration] file server closed.`);
  });

  it('can upload and query txt file', async () => {
    // mediaManager.query({});
    expect(true).toBe(true);
  });
}
