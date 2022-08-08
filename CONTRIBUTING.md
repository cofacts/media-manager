# Contributing to Media Manager

This project uses npm and Node.JS. Please use the Node.JS version specified in `engines` in `package.json`.

## Install dependencies

```bash
npm i
```

## On-the-fly build

Use the following command to build latest library to `/dist` on-the-fly:

```bash
npm start
```

This builds to `/dist` and runs the project in watch mode so any edits you save inside `src` causes a rebuild to `/dist`.

## Build

To do a one-off build, use `npm run build`.

## Jest

Jest tests are set up to run with `npm test`.

## Lint

Use `npm run lint` to perform lint.

## Integration tests

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
    - If you forked `@cofacts/media-manager` to your account, please make sure `NPM_TOKEN` secret exists in the Github action secret.
