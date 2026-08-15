# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@0.17.0 create --template minimal --types ts --add prettier eslint vitest="usages:unit,component" playwright tailwindcss="plugins:typography,forms" --install pnpm 06-atmo-watch
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## API Worker

The public Contrail API is a separate Cloudflare Worker under [`api/`](api/README.md). Use `pnpm api:dev`, `pnpm api:check`, and `pnpm api:deploy` from the repository root.

## Cloudflare deployment

The web app uses `@sveltejs/adapter-cloudflare` and the Worker configuration in
[`wrangler.jsonc`](wrangler.jsonc). It has dedicated `atmo-watch` KV namespaces bound as:

- `OAUTH_SESSIONS`
- `OAUTH_STATES`
- `MEDIA_CACHE`

`MEDIA_CACHE` caches TMDB and OMDb data. The other two namespaces store AT Protocol OAuth state and sessions.

Before the first deployment, configure the private runtime values without adding them to `wrangler.jsonc`:

```sh
pnpm exec wrangler secret put COOKIE_SECRET
pnpm exec wrangler secret put CLIENT_ASSERTION_KEY
pnpm exec wrangler secret put TMDB_ACCESS_TOKEN
pnpm exec wrangler secret put OMDB_API_KEY # optional
```

`ORIGIN` is configured as `https://atmo.watch` in `wrangler.jsonc`. Build, preview, or deploy with:

```sh
pnpm build
pnpm preview
pnpm deploy
```
