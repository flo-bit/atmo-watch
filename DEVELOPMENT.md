# Development

## Local development

The public Contrail API runs as a separate Cloudflare Worker under [`api/`](api/README.md). The generated client supports both the deployed API and a local instance:

```sh
pnpm dev          # use the deployed API at https://api.atmo.watch
pnpm api:dev      # start only the local SQLite API
pnpm dev:local    # use an already-running local API
pnpm dev:stack    # start the local API and web app together
```

Local mode uses `http://127.0.0.1:8787` and stores its SQLite database under `.contrail/`. It never falls back to production when the local API is unavailable. For a custom local port, run `CONTRAIL_URL=http://127.0.0.1:<port> pnpm dev`.

### API contract changes

Run `pnpm contrail:generate` after changing the API config. Deploy the API before the frontend, then refresh the production provider lock and generated target:

```sh
pnpm contrail:generate
pnpm api:check
pnpm api:deploy
pnpm contrail:update:prod
```

Commit the regenerated lock, client, Lexicons, and types. See [`api/README.md`](api/README.md) for API setup, backfill, and ingestion recovery.

### Validation

```sh
pnpm check
pnpm api:check
pnpm exec vitest run --project server
```

The SQL tests use Node's built-in SQLite, including query-plan assertions for identifier index usage.

## Cloudflare deployment

The web app uses `@sveltejs/adapter-cloudflare` and [`wrangler.jsonc`](wrangler.jsonc), with `ORIGIN` set to `https://atmo.watch`.

Before the first deployment, configure the private runtime values without adding them to `wrangler.jsonc`:

```sh
pnpm exec wrangler secret put COOKIE_SECRET
pnpm exec wrangler secret put CLIENT_ASSERTION_KEY
pnpm exec wrangler secret put TMDB_ACCESS_TOKEN
pnpm exec wrangler secret put OMDB_API_KEY # optional
```

```sh
pnpm build
pnpm preview
pnpm deploy
```

`pnpm deploy` builds the app before deploying it.

### Storage and artwork

The Worker has three dedicated KV bindings:

- `OAUTH_SESSIONS` and `OAUTH_STATES` store AT Protocol OAuth sessions and state.
- `MEDIA_CACHE` stores the small, slow-changing OMDb ratings dataset and site-wide TMDB artwork overrides.

General TMDB data uses Cloudflare's Cache API with a small per-isolate memory cache, avoiding high-volume KV writes for media and search caching.

Media artwork can be curated at `/movie/[id]/edit` or `/tv/[id]/edit`. Access is restricted by AT Protocol DID; configure additional curators with the comma- or whitespace-separated `MEDIA_CURATOR_DIDS` private runtime value.

## Public response caching

- Movie/TV `og.png` handlers cache rendered PNGs for **24 hours**. Keys use media type, numeric TMDB ID, and saved artwork revision, not slugs or query parameters. Editing artwork selects a new key. Concurrent requests share one render within an isolate, with separate response bodies. Bump the cache version in `src/lib/og-cache.server.ts` when changing the image template. Embedded scores refresh with the image TTL.
- Public rating summaries, anonymous media review pages, and submitted video lists use a **60-second** Cache API + per-isolate memory cache. Successful empty results are cached; failures are not. Pagination, media types/IDs, and TV seasons have separate keys. Signed-in catalog loads bypass community caches; authenticated review results and hydrated viewer likes never enter the shared cache.
- Anonymous catalog loads first check `watch.atmo.review.getCommunityPresence`, cached for **five minutes** by media type/numeric ID. This avoids unnecessary enrichment calls for empty titles and loads only relevant review/video branches. TV presence includes season/episode videos; video and season subpages use the same hint. First-time community content can take up to five minutes to appear anonymously, plus ingestion delay. Signed-in loads bypass the hint. Errors fall back to normal enrichment rather than being cached as empty; nonexistent catalog entries fail before community queries.
- Healthy homepage results use a **six-hour** cache, including displayed Popfeed ratings; partial/empty results expire after **one minute**. Titles are selected and ordered by ratings from the last 30 days, but displayed scores and counts use all-time summaries. A new rating can take up to six hours to appear on the homepage; underlying TMDB/OMDb data keeps its longer caches.

Cache API storage is best-effort and local to each Cloudflare data center. Cache failures fall back to normal generation/fetching. Outside Cloudflare, public JSON caching still uses memory; finished PNGs are not retained after their in-flight render completes.

Do not enable blanket shared HTML caching: pages contain viewer-specific likes and country-dependent streaming availability. OAuth/session data never enters public caches. Profile-review OG images and intentionally random scene reads do not use the catalog OG/community caches.

## Homepage availability

Homepage enrichment has a shared **eight-second** network deadline and preserves available sections when providers fail:

- TMDB media-detail and theaters GETs use a cancellable direct transport with a **2.5-second** deadline, avoiding the SDK retry loop.
- Contrail server reads use a **three-second** transport deadline and preserve the generated endpoint/auth contract.
- OMDb fetches have a **1.8-second** deadline inside a **3.5-second** total enrichment budget. Homepage optional ratings waits are capped at **two seconds** and observe the page deadline. Failures retain the transient-failure/quota backoff.
- Public cache reads/writes have **750 ms** bounded awaits; artwork KV reads have **one-second** bounded awaits. These platform operations are not cancellable, so the limits stop waiting rather than aborting the operation.

Network deadlines cover response-body transfer, not just headers, and use abort signals. Timers are cleared after completion. The eight-second enrichment budget is not a strict end-to-end response limit: cache, artwork, and session/layout work also take time.

Partial/empty homepage results are cached briefly to prevent a failure storm and show a small availability notice; they never replace a healthy result for six hours. Search, reviews, and healthy title/theaters sections remain usable.

These protections do not repair stalled ingestion. Read the [API recovery guidance](api/README.md) before recovery; never reset or jump an expired cursor just to silence a health warning.

## Catalog crawling and indexing

- [`static/robots.txt`](static/robots.txt) excludes cast filmographies, frontend API routes, artwork editors, and secondary catalog video/season pages. It does not block title pages, profiles, individual community reviews/lists, or individual submitted videos.
- Empty title pages receive `X-Robots-Tag: noindex, nofollow` and matching HTML metadata. Rating-only reviews or submitted TV descendant videos count as community content. Unknown presence/enrichment failures do not de-index titles.
- Cast, season, and catalog-video pages also have `noindex, nofollow` metadata. Cast/recommendation/filmography/season expansion links use selective `rel="nofollow"`; ordinary community/discovery title links remain followable.
- Title canonical links and `og:url` use the numeric ID plus normalized title slug, without alias slugs, leading zeros, or query parameters. Alias URLs still work; canonical tags consolidate indexing rather than preventing fetches.

Robots exclusions are voluntary, not access controls. `noindex` requires a fetch and cannot remove an already-indexed URL while robots blocks fetching it; `nofollow` is a hint. Blocking unwanted bots requires separate Cloudflare edge rules; these application controls do not impose a spending cap.
