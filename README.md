# atmo.watch

review movies and tv shows with your atmosphere account, using popfeed.social's lexicons.

## API Worker

The public Contrail API is a separate Cloudflare Worker under [`api/`](api/README.md). The web app has explicit production and local Contrail modes:

```sh
pnpm dev          # use the deployed API at https://api.atmo.watch
pnpm api:dev      # start only the local API
pnpm dev:local    # use an already-running local API
pnpm dev:stack    # start the local API and web app together
```

Local mode waits for `http://127.0.0.1:8787` by default and generates an ignored consumer contract under `.contrail/local-consumer`. The API command creates the ignored `api/.dev.vars` from `api/.dev.vars.example` when needed. For a custom URL, set both `ATMO_LOCAL_API_URL` and `CONTRAIL_PUBLIC_ENDPOINT` in that vars file. Local mode never falls back to production when the API is unavailable.

The tracked generated contract under `src/lib/contrail` represents the API source tree. `src/lib/contrail-targets/prod.ts` pins the currently deployed production runtime contract. After deploying an API contract change, run `pnpm contrail:update:prod` and commit the regenerated production target and consumer files before deploying the web app.

Use `pnpm api:check` and `pnpm api:deploy` for API validation and deployment.

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
