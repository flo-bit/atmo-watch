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

### Public response caching

- Movie/TV `og.png` handlers cache **rendered PNGs for 24 hours** in Cloudflare's Cache API. Keys use the media type, numeric TMDB ID, and saved artwork revision; slugs and query parameters cannot create extra render variants. Editing artwork selects a new cache key. Concurrent requests for the same key share one render within an isolate, with a separate readable response body for each caller. Bump the cache version in `src/lib/og-cache.server.ts` when changing the image template.
- Public rating summaries, **anonymous** media review pages, and submitted video lists use a **60-second** Cache API + per-isolate memory cache. Successful empty results are cached; failed requests are not. Review pagination, media types/IDs, and TV seasons have separate keys. Signed-in review requests bypass this cache so hydrated viewer likes cannot leak between users. Community changes can take about a minute to appear in cached public data; scores embedded in OG images refresh with the image TTL.
- Cache API storage is best-effort and local to each Cloudflare data center. New/evicted keys still require rendering or API reads; this complements crawler blocking, rather than replacing it. Cache failures fall back to normal generation/fetching. Outside Cloudflare, public JSON caching still uses memory; finished PNGs are not retained after their in-flight render completes.
- Do not enable blanket shared caching for HTML: pages contain viewer-specific likes and country-dependent streaming availability. OAuth/session data is never put into these public caches. Profile-review OG images and intentionally random scene reads are unchanged.

Run the server-side cache regression tests with `pnpm exec vitest run --project server`.

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
