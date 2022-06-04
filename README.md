# Cofacts Media Manager

[![CI](https://github.com/cofacts/media-manager/actions/workflows/main.yml/badge.svg)](https://github.com/cofacts/media-manager/actions/workflows/main.yml) [![Coverage Status](https://coveralls.io/repos/github/cofacts/media-manager/badge.svg?branch=main)](https://coveralls.io/github/cofacts/media-manager?branch=main)

Design: https://g0v.hackmd.io/@mrorz/cofacts-media-manager

## Usage

```js
import MediaManager from '@cofacts/media-manager';

// Setup
const manager = new MediaManager({
  credentialsJSON: process.env.GCS_CREDENTIALS,
  bucketName: process.env.GCS_BUCKET_NAME,

  // The prefix of where files are put.
  // Trailing `/` is REQUIRED if you want files to be put in a "directory" on GCS web console. Otherwise, root directories will just have specified prefix in its front.
  // If not given, files will be placed right insight the bucket.
  prefix: 'some-dir/'
});

// Search
const { hits } = await manager.query({url: 'https://......'});

// Upload and index
const { id, url } = await manager.insert({url: 'https://......'});
```

### Install

Install cofacts/media-manager via npm:

```
npm i @cofacts/media-manager
```

### Service account permission
The service account should have the following [permissions](https://cloud.google.com/storage/docs/access-control/iam-roles) to the bucket:
- `storage.objects.list`
- `storage.objects.create`
- `storage.objects.get`
- `storage.objects.delete`

## Development

This project uses npm and Node.JS. Please use the Node.JS version specified in `engines` in `package.json`.

### Install dependencies

```bash
npm i
```

### On-the-fly build

Use the following command to build latest library to `/dist` on-the-fly:

```bash
npm start
```

This builds to `/dist` and runs the project in watch mode so any edits you save inside `src` causes a rebuild to `/dist`.

### Build

To do a one-off build, use `npm run build`.

### Jest

Jest tests are set up to run with `npm test`.

### Lint

Use `npm run lint` to perform lint.

### Bundle Analysis

[`size-limit`](https://github.com/ai/size-limit) is set up to calculate the real cost of media-manager with `npm run size` and visualize the bundle with `npm run analyze`.

### Integration tests

Real integration tests are enabled if correct environment variables are provided.
Copy `.env.sample` to `.env` to get started.

If the environment variables are provided in `.env`, running `npm t` will also trigger an integration test, which will:

1. Cleanup files with `PREFIX` in `BUCKET` specified by `.env`
2. Start a static file server that serves files under `test/fixtures`
3. Instantiate `MediaManager` that connects to GCS using credentials provided in `.env`
4. Perform query & insertion on live Google Cloud Storage

### Publishing new versions

1. Run [`npm version`](https://docs.npmjs.com/cli/v8/commands/npm-version) and specify which version number to bump
2. Check version bump and push to `main` branch
3. Wait for build pass
4. [Create a release on Github](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository#creating-a-release) using the version tag; it will trigger publication of the version on npm.
