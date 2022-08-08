# Cofacts Media Manager

[![CI](https://github.com/cofacts/media-manager/actions/workflows/main.yml/badge.svg)](https://github.com/cofacts/media-manager/actions/workflows/main.yml) [![Coverage Status](https://coveralls.io/repos/github/cofacts/media-manager/badge.svg?branch=main)](https://coveralls.io/github/cofacts/media-manager?branch=main)
[![npm](https://nodei.co/npm/@cofacts/media-manager.png?mini=true)](https://www.npmjs.com/package/@cofacts/media-manager)

Cofactes Media Manager is a Node.JS API that provides the following functionality for images and other files:
- Store files and return an unique identifier (Media Entry ID) for each unique file; duplicate files are ignored.
- Search for a file with a query file.
- Return underlying Google Cloud Storage `File` object given the media entry ID.
- Pre-process and store as [variants](#variants-and-transformers).

## Install

Install cofacts/media-manager via npm:

```sh
npm i @cofacts/media-manager
```

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

On the GCS bucket, the files will be organized in the following tree hierarchy:

```
some-dir/
  image/
    <search-hash>/
      <id-hash>/
        original
  file/
    <id-hash>/
      original
```

It is designed so that Media Manager can retrieve files using path prefix. You may refer to [the wiki](https://github.com/cofacts/media-manager/wiki/Media-Manager-Design) for the design choice.

### Variants and transformers

> Reference: [GetVariantSettingsFn](https://cofacts.github.io/media-manager/types/GetVariantSettingsFn.html)

You can define multiple variants for each uploaded file by providing `getVaraintSettings` method to the `MediaManager` constructor, or when calling `mediaManager.insert()`.

Your `getVaraintSettings` should return a list of [`VariantSetting`](https://cofacts.github.io/media-manager/interfaces/VariantSetting.html) objects. When you call `mediaManager.insert()`, Media manager will process on-the-fly and emit one file on GCS for each `VariantSetting` returned by `getVaraintSettings`.

We provide a [`variant.original` factory function](https://cofacts.github.io/media-manager/functions/variants.original.html) that generates just one `VariantSetting` object that does not transform the data, so that the original file is stored to GCS. This is also used in [the default `getVariantSettings`](https://cofacts.github.io/media-manager/functions/variants.defaultGetVariantSettings.html).

```js
import MediaManager, { variants } from '@cofacts/media-manager';
import sharp from 'sharp';

// Setup
const manager = new MediaManager({
  credentialsJSON: '{"type": "service_account", "project_id": "..." ...}',
  bucketName: 'my-gcs-bucket',
  prefix: 'some-dir/',

  // Example:
  // 1. store 1 scaled image and the original file for images
  // 2. store just the original file for other files
  //
  getVariantSettings({
    type, // 'image' | 'audio' | 'video' | 'file'
    contentType,
  }) {
    if(type === 'image') return [
      // Emits the original uplaoded file to GCS
      variants.original(contentType),

      // Emits a 100-px wide webp image
      {
        name: 'thumbnail',
        contentType: 'image/webp',
        transform: sharp().resize(100).webp(),
      }
    ];

    return [
      // Emits the original uplaoded file to GCS
      variants.origina(contentType),
    ]
  }
});

// Get the GCS file object for the "thumbnail" variant
const file = manager.getFile('<MediaEntry ID>', 'thumbnail');

// or
const mediaEntry = manager.get('<MediaEntry ID>');
mediaEntry.get('thumbnail'); // Throws if `thumbnail` variant does not exist on GCS

```

On the GCS bucket, the files will be organized in the following tree hierarchy:

```
some-dir/
  image/
    <search-hash>/
      <id-hash>/
        original
        thumbnail
  file/
    <id-hash>/
      original
```

### Media entry on GCS

Even though you can browse the file in your bucket directly on GCS, you don't have to traverse the bucket by yourself. Instead, you should access the files and their variants by their corresponding *media entriy*.

Each uploaded file maps to a [media entry](https://cofacts.github.io/media-manager/interfaces/MediaEntry.html) on Media Manager. On Google Cloud Storage, it maps to a
directory that hosts different [variant files](#variants-and-transformers).

By default there is only one variant, `original`, representing the originally uploaded file; all bytes are stored as-is without any pre-processing.

Each media entry has a unique identifier (media entry ID). For images they are like: `image.vDph4g.__-AD6SDgAebG8cbwifBB-Dj0yPjo8ETgAOAA4P_8_8`. For other files it look may look like `file.Dmqp3Bl7QD7dodKFpPLZss1ez1ef8CHg3oy9M7qndAU`. The media entry ID is always URL-safe.

Media manager also provides methods like `mediaManager.get()` so that you can get a media entry by its ID. Through the media entry, you can either get its public URL on GCS, or directly get a [GCS file object](https://googleapis.dev/nodejs/storage/latest/File.html) if you want further control.

### Search for files: `mediaManager.query()`

> Reference: [MediaManager#query](https://cofacts.github.io/media-manager/classes/MediaManager.html#query)

`mediaManager.query()` takes the URL of the query image as the input, and returns the search result.

The search result may multiple search hits for similar images; one hit (exact match) for other formats.

For how image similarity works, please refer to [the wiki](https://github.com/cofacts/media-manager/wiki/Media-Manager-Design).

### Upload files: `mediaManager.insert()`

> Reference: [MediaManager#insert](https://cofacts.github.io/media-manager/classes/MediaManager.html#insert)

This method will upload file of the given URL to Google Cloud Storage.

Files with identical or near duplicate image content will produce the same identifier, so there will be no duplicates on your GCS bucket.

`insert()` resolves as soon as all data in `MediaEntry` is resolved -- which is the time the unique identifier `id` is generated from actual file content.

By the time `insert()` resolves, it is possible that files are still being uplaoded to GCS. When upload succeeded, `onUploadStop(null)` will be called. If upload fails or the file already exists, `onUploadStop(err)` will be called.

## API Reference

The documentation of `MediaManager`'s all methods and arguments are available at: https://cofacts.github.io/media-manager/classes/MediaManager.html.

For the detailed requirements of the Google Cloud Storage bucket and service account, please refer to [the documentation of `MediaManager`'s constructor arguments](https://cofacts.github.io/media-manager/types/MediaManagerOptions.html).

