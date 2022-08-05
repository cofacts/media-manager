# Cofacts Media Manager

[![CI](https://github.com/cofacts/media-manager/actions/workflows/main.yml/badge.svg)](https://github.com/cofacts/media-manager/actions/workflows/main.yml) [![Coverage Status](https://coveralls.io/repos/github/cofacts/media-manager/badge.svg?branch=main)](https://coveralls.io/github/cofacts/media-manager?branch=main)

Cofactes Media Manager is a Node.JS API that provides the following functionality for image, video,
audio:
- Store files and return an unique identifier (Media Entry ID) for each unique file; duplicate files are ignored
- Search for a file with a query file
- Return underlying Google Cloud Storage `File` object given the media entry ID.
- Pre-process and store as variants

## Usage

The code snippet below shows how to setup the connection Google Cloud Storage, and how to search for
a file in the bucket, and how to add new files to the bucket.

```js
import MediaManager from '@cofacts/media-manager';

// Setup
const manager = new MediaManager({
  // Google Cloud service account's JSON key, in string format.
  credentialsJSON: '{"type": "service_account", "project_id": "..." ...}',

  // The Google Cloud Storage bucket name
  bucketName: 'my-gcs-bucket',

  // The prefix of where files are put.
  // Trailing `/` is REQUIRED if you want files to be put in a "directory" on GCS web console. Otherwise, root directories will just have specified prefix in its front.
  // If not given, files will be placed right insight the bucket.
  prefix: 'some-dir/'
});

// Search
const { hits } = await manager.query({url: 'https://url/of/file/to/search'});

// Upload and index
const { id, url } = await manager.insert({url: 'https://url/of/file/to/store'});
```

On the Google cloud storage, the files will be organized in the following tree hierarchy:

TODO: tree

It is designed so that Media Manager can retrieve files using path prefix.

### Media entry on GCS

Each uploaded file maps to a *media entry* on Media Manager. On Google Cloud Storage, it maps to a
directory that hosts different [variant files](#variants-and-transformers).

By default there is only one variant, `original`, representing the originally uploaded file; all bytes are stored as-is without any pre-processing.

Each media entry has a unique identifier (media entry ID). For images they are like: `image.vDph4g.__-AD6SDgAebG8cbwifBB-Dj0yPjo8ETgAOAA4P_8_8`. For other files it look may look like `file.Dmqp3Bl7QD7dodKFpPLZss1ez1ef8CHg3oy9M7qndAU`. The media entry ID is always URL-safe.

Media manager also provides methods like `mediaManager.get()` so that you can get a media entry by its ID.

### Search for files: `mediaManager.query()`

It can return multiple search hit for images; one hit (exact match) for videos, audios or other formats.

TODO: return value of search hits
Image file with multiple hits

### Upload files: `mediaManager.insert()`

This method will upload file of the given URL to Google Cloud Storage.

Files with identical or near duplicate image content will produce the same identifier, so there will be no duplicates on your GCS bucket.

`insert()` resolves as soon as all data in `MediaEntry` is resolved -- which is the time the unique identifier `id` is generated from actual file content.

Under the hood, instead of just downloading the whole file from the given URL and process it, all processing of `insert()`
is done in a stream fasion. When `insert({url})` is called, it will take the following steps in practice:

1. Get the NodeJS readable stream to read the URL
2. Connect the readable stream to to all [variant transformers](#variants-and-transformers), and a temporary location on GCS.
3. Connect the readable stream to file identifier that consumes the file and generates its media entry ID.
4. Wait until the ID is generated. Resolve `insert()` promise as soon ID is generated.
5. Check if the media entry with the ID already exists on GCS.
   - If so, delete the temporary files.
   - If not, move the temporary files to the folder of the media entry.

By the time `insert()` resolves, it is possible that files are still being uplaoded to GCS. When upload succeeded, `onUploadStop(null)` will be called. If upload fails or the file already exists, `onUploadStop(err)` will be called.

### Variants and transformers

TODO:
- Upload is processed in Node.JS streams
- How to setup variants and write transformers

## API Reference

TBA

## Install

Install cofacts/media-manager via npm:

```
npm i @cofacts/media-manager
```

## Service account permission

The service account should have the following [permissions](https://cloud.google.com/storage/docs/access-control/iam-roles) to the bucket:
- `storage.objects.list`
- `storage.objects.create`
- `storage.objects.get`
- `storage.objects.delete`
