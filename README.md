# atmo.watch

review movies and tv shows with your atmosphere account, using popfeed.social's lexicons.

movie and show data by tmdb

## API Worker

The public Contrail API is a separate Cloudflare Worker under [`api/`](api/README.md). Contrail's generated client supports both the deployed target and the local API:

```sh
pnpm dev          # use the deployed API at https://api.atmo.watch
pnpm api:dev      # start only the local SQLite API
pnpm dev:local    # use an already-running local API
pnpm dev:stack    # start the local API and web app together
```

Local mode uses `http://127.0.0.1:8787` and stores its SQLite database under `.contrail/`. Set `CONTRAIL_URL` to another loopback URL when running the web app against a custom local port. It never falls back to production when the local API is unavailable.

Run `pnpm contrail:generate` after changing the API config to regenerate the typed source contract. After deploying that contract with `pnpm api:deploy`, run `pnpm contrail:update:prod` to refresh the production provider lock and generated target. Commit the regenerated lock, client, Lexicons, and types.

Use `pnpm api:check` for API validation.

## Cloudflare deployment

The web app uses `@sveltejs/adapter-cloudflare` and the Worker configuration in
[`wrangler.jsonc`](wrangler.jsonc). It has dedicated `atmo-watch` KV namespaces bound as:

- `OAUTH_SESSIONS`
- `OAUTH_STATES`
- `MEDIA_CACHE`

The first two namespaces store AT Protocol OAuth state and sessions. `MEDIA_CACHE` stores the small, slow-changing OMDb ratings dataset and site-wide TMDB artwork overrides. General TMDB data uses Cloudflare's Cache API with a small per-isolate memory cache, avoiding high-volume KV writes for media and search caching.

Media artwork can be curated at `/movie/[id]/edit` or `/tv/[id]/edit`. Access is restricted by AT Protocol DID; additional curator DIDs can be configured with the comma- or whitespace-separated `MEDIA_CURATOR_DIDS` private runtime value.

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
