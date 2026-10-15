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
- Public rating summaries, **anonymous** media review pages, and submitted video lists use a **60-second** Cache API + per-isolate memory cache. Successful empty results are cached; failed requests are not. Review pagination, media types/IDs, and TV seasons have separate keys. Signed-in catalog loads bypass community caches for fresh post-publish data; authenticated review results and hydrated viewer likes never enter the shared cache. Scores embedded in OG images refresh with the image TTL.
- Anonymous catalog loads first check `watch.atmo.review.getCommunityPresence`, cached for **five minutes** by media type/numeric ID. Empty movies/shows make one indexed existence query instead of three/four enrichment calls. Review-only and video-only titles load only the relevant branches; TV presence includes season/episode videos. Video and season subpages use the same hint. New first-time community content can take up to five minutes to appear anonymously, plus ingestion delay; signed-in loads bypass the hint and public community caches. Errors are not cached as empty and fall back to normal enrichment. Nonexistent catalog entries fail before any community queries.
- Healthy homepage results keep their **six-hour** cache, including displayed Popfeed ratings; degraded/empty results expire after **one minute**. Titles are selected/ordered by the last 30 days of ratings, but their displayed score and count use the **all-time** summary, just like the title page. A new rating can therefore take up to six hours to appear on the homepage; underlying TMDB/OMDb data keeps its longer caches.
- Cache API storage is best-effort and local to each Cloudflare data center. New/evicted keys still require rendering or API reads; this complements crawler blocking, rather than replacing it. Cache failures fall back to normal generation/fetching. Outside Cloudflare, public JSON caching still uses memory; finished PNGs are not retained after their in-flight render completes.
- Do not enable blanket shared caching for HTML: pages contain viewer-specific likes and country-dependent streaming availability. OAuth/session data is never put into these public caches. Profile-review OG images and intentionally random scene reads are unchanged.

### Homepage availability

Homepage enrichment has a shared **eight-second** network deadline and preserves available sections when other providers fail. TMDB media-detail and theaters GETs use a cancellable direct transport (**2.5 seconds**, no SDK retry loop); the SDK does not support signals/injectable fetch. Contrail server reads use a **three-second** transport deadline. Both cover response-body transfer, not just headers, and preserve the generated endpoint/auth contract.

OMDb fetches have a **1.8-second** deadline inside a **3.5-second** total enrichment budget; homepage optional ratings waits are capped at **two seconds** and observe the page deadline. Failed rating requests retain the existing transient-failure/quota backoff rather than poisoning an in-flight promise indefinitely. All timers are cleared after completion.

Public cache reads/writes have **750 ms** bounded awaits, and artwork KV reads have **one-second** bounded awaits. KV and Cache API operations are not cancellable: these limits stop waiting, not the underlying platform operation. Network fetches receive actual abort signals. The eight-second enrichment budget is not a strict end-to-end response limit: cache, artwork, and session/layout work also take time.

Partial/empty homepage results are cached briefly to prevent a failure storm, with a small availability notice in the UI; they never replace a healthy result for six hours. Search, reviews, and any healthy title/theaters sections remain usable.

These availability protections do not repair stalled ingestion. Check `api/README.md` before any recovery; never reset/jump an expired cursor just to silence the health warning.

### Catalog crawling and indexing

- `static/robots.txt` excludes cast filmographies, frontend API routes, artwork editors, and secondary catalog video/season pages. It does **not** block title pages, profiles, individual community reviews/lists, or individual submitted videos.
- Empty title pages receive `X-Robots-Tag: noindex, nofollow` and matching HTML metadata. Rating-only reviews or submitted TV descendant videos count as community content. Unknown presence/enrichment failures do not de-index titles.
- Cast, season, and catalog-video pages have `noindex, nofollow` metadata too. Cast/recommendation/filmography/season expansion links use selective `rel="nofollow"`; ordinary community/discovery title links remain followable.
- Title canonical links and `og:url` use the numeric ID plus normalized title slug, without incoming alias slugs, leading zeros, or query parameters. Alias URLs still work for users; canonical tags consolidate indexing rather than preventing fetches.
- Robots exclusions are voluntary and prevent compliant fetching, not access. `noindex` requires a fetch and cannot remove an already-indexed URL while robots blocks fetching it. `nofollow` is a hint, not an enforcement mechanism. Unwanted bots need Cloudflare edge rules; this change does not configure WAF rules or impose a spending cap.

Deploy the API **before** the frontend so the new presence method is available. Then refresh the production contract with `pnpm contrail:update:prod` as described above. Existing production auth permissions are unchanged; no D1 migration is needed because the probes use Contrail's existing queryable-field indexes. No global shared HTML caching is introduced.

Run the server-side regression tests with `pnpm exec vitest run --project server`. The SQL tests use Node's built-in SQLite, including query-plan assertions for identifier index usage.

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
