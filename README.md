# Cofacts Media Manager

[![CI](https://github.com/cofacts/media-manager/actions/workflows/main.yml/badge.svg)](https://github.com/cofacts/media-manager/actions/workflows/main.yml) [![Coverage Status](https://coveralls.io/repos/github/cofacts/media-manager/badge.svg?branch=main)](https://coveralls.io/github/cofacts/media-manager?branch=main)

Design: https://g0v.hackmd.io/@mrorz/cofacts-media-manager

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
