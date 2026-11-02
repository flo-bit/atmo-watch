# Development

## Local development

Contrail 0.28.0 runs inside the SvelteKit Worker, just like RSVP. Server reads go directly to the request's D1 binding; authenticated writes go to the user's PDS and notify the embedded AppView before returning. No separate API, service-auth scope, or `CONTRAIL_URL` is needed.

```sh
pnpm dev                 # web app + embedded local D1
pnpm backfill            # populate the same local Wrangler D1 storage
```

The Cloudflare adapter supplies the local `DB` binding and persists it under `.wrangler/state/`. It never falls back to production. The former `.contrail/dev.sqlite` is no longer used. Dev does not run scheduled events: backfill to populate local data, and invoke `/api/cron` with `X-Cron-Secret` when testing live ingestion. Set `CRON_SECRET` in your untracked `.dev.vars` for local cron testing.

### Atmo Kit

Watch uses published `@atmo-dev/kit` components and Sketchyicons. Keep the movie-specific layouts in Watch; shared controls, login, profiles, and theme tokens come from Kit. The app stays dark zinc/fuchsia, with the theme on `<body>` so portaled dialogs inherit the same color scheme.

Use Corepack to honor the pinned pnpm version. To develop against the sibling checkout, first run Kit's package watcher in another terminal:

```sh
cd ../00-atmo-kit/kit
corepack pnpm install
corepack pnpm exec svelte-package --watch
```

Then, from Watch:

```sh
corepack pnpm kit:local
corepack pnpm dev
```

`kit:local` switches only the installed dependencies to `../00-atmo-kit/kit`, without changing manifests or the committed registry lockfile. `ATMO_KIT_PATH=/path/to/kit corepack pnpm kit:local` selects another built checkout. Imports continue to use the package's `dist` exports; Vite follows its resolved location and deduplicates Svelte and Bits UI.

To switch back:

```sh
corepack pnpm kit:registry
```

Restart the dev server after switching. A frozen install also restores published dependencies; rerun `kit:local` after installing if needed. Local mode is rejected in CI. `kit:local` only selects the UI package; it does not change storage or Contrail.

Run `corepack pnpm test:kit-dev` for offline dependency-switching tests and `corepack pnpm exec vitest run --project client` for browser regressions covering avatar/poster sizing, view selection, filled half-star ratings, navigation, backdrops, the footer, and portaled dark-theme/focus behavior.

#### Temporary lightbox backport

Kit's `PhotoLightbox` has not been published in `0.3.0` yet. `patches/@atmo-dev__kit@0.3.0.patch` backports its packaged component, types, and exports from the local Kit checkout. Registry installs and CI therefore remain self-contained; Watch imports `PhotoLightbox` from `@atmo-dev/kit` rather than keeping a second app-owned carousel. Local mode skips only this Kit patch, since the checkout already includes it. Remove the patch and its `patchedDependencies` entry when adopting a Kit release that exports the lightbox.

### App icons

The app icon uses Sketchyicons' hand-drawn camera on fuchsia, matching Watch's accent. Regenerate the SVG favicon, multi-size ICO, PNG favicon, Apple touch icon, regular app icons, maskable icon, and web manifest with:

```sh
corepack pnpm generate:favicons
corepack pnpm test:favicons
```

The generator follows RSVP's setup. Tests check committed copies, SVG geometry, PNG/ICO dimensions, manifest links, opaque home-screen backgrounds, and the maskable safe area.

### Legal pages

`src/lib/legal.ts` owns the Terms, Privacy, and Imprint text. Kit renders those snapshots and the footer; TMDB/JustWatch attribution sits above the legal links. Contact and reports use `reports@atmo.social`.

These documents are drafts and receive `noindex, nofollow`. Review `legalReviewNeeded` before publishing: the imprint needs a full postal address, and legal bases, retention periods, processors/transfers, third-party media/storage requirements, and reporting procedures still need confirmation. Do not invent those details or mark documents published automatically during a package update. After review, update the app-owned text, set `status: 'published'`, and provide its reviewed revision date.

### Contrail contract changes

Edit `src/lib/contrail.config.ts` and the source Lexicons under `lexicons/custom/` or `lexicons/pulled/`, then regenerate:

```sh
pnpm contrail:generate
pnpm contrail:check
pnpm check
```

Commit the generated Lexicons and `src/lib/contrail/types/`. There is no remote provider lock or separate API deployment. The embedded client derives its methods and tracked collections from the bundled contract. Public queries are available at `/xrpc/watch.atmo.*`; HTTP mutations are not exposed. Server-side remote functions use in-process notify instead.

The `patches/@atmo-dev__contrail@0.28.0.patch` retains Watch's fail-closed `FutureCursor` guard. Do not remove it until upstream rejects ahead-of-source cursors; `src/lib/server/contrail/jetstream-cursor.test.ts` covers that regression. The older Worker fetch/CPU fixes are already upstream, and cron error propagation is now app-owned.

### Validation

```sh
pnpm check
pnpm contrail:check
pnpm exec vitest run --project server
```

The SQL tests use Node's built-in SQLite, including query-plan assertions for identifier index usage.

## Cloudflare deployment

The web app uses `@sveltejs/adapter-cloudflare` and [`wrangler.jsonc`](wrangler.jsonc), with `ORIGIN` set to `https://atmo.watch`.

Before the first deployment, configure the private runtime values without adding them to `wrangler.jsonc`:

```sh
pnpm exec wrangler secret put COOKIE_SECRET
pnpm exec wrangler secret put CLIENT_ASSERTION_KEY
pnpm exec wrangler secret put CRON_SECRET # required for scheduled ingestion
pnpm exec wrangler secret put TMDB_ACCESS_TOKEN
pnpm exec wrangler secret put OMDB_API_KEY # optional
```

```sh
pnpm build
pnpm preview
pnpm deploy
```

`pnpm deploy` builds the app before deploying it. `pnpm build` also runs `contrail append-scheduled`, which adds a one-minute scheduled handler forwarding to the secret-protected `/api/cron` endpoint. Forwarding uses JSON content type to pass SvelteKit's production CSRF guard and reports non-2xx responses as scheduled failures. Ingestion is bounded to 20 seconds / 250 candidates and runs bounded backfill retries even if ingestion fails.

### Cutover from the standalone API

The root `wrangler.jsonc` retains `atmo-watch-contrail-g20261026` (`93dbdac8-57a5-4485-b884-f12899122a69`) and the config retains its ordered-source epoch. Contrail's schema/index upgrades run in place on first initialization; no data/cursor reset or backfill is normally necessary.

1. Back up the existing remote D1 with `pnpm exec wrangler d1 export DB --remote --output /safe/path/watch-before-embedded.sql`.
2. **Stop the old `atmo-watch-api` cron before starting the new version.** Do not run old Contrail code against an upgraded schema. In Cloudflare's dashboard remove the old Worker's cron trigger, or use `wrangler triggers deploy` with a temporary config containing `{"name":"atmo-watch-api","triggers":{"crons":[]}}`.
3. Set `CRON_SECRET` on `atmo-watch`, then run `pnpm deploy`.
4. Check `https://atmo.watch/status`, `https://atmo.watch/health/ingestion`, and `/xrpc/watch.atmo.review.listRecords?limit=1`. Confirm the checkpoint advances after scheduled runs and test a signed-in write.
5. Retire the old `atmo-watch-api` Worker/custom domain after checking any external consumers. Watch no longer calls `api.atmo.watch` or needs its OAuth RPC permission. Existing sessions can keep their old extra permission until reauthorization.

Production cutover completed on 2026-11-01 using the existing D1, with no backfill. The legacy `api.atmo.watch` Worker now has **no database binding or cron**: GET/HEAD requests redirect to the same path on `atmo.watch`, and mutations return 410. Its redirect source/config and cutover metadata are archived alongside the pre-upgrade database export outside the repository.

Do not roll an old Worker back onto an upgraded database. For rollback, restore the backup to a separate database and bind the old Worker to that copy.

### Fresh databases and ingestion recovery

For a clean rebuild, create a new D1 (`pnpm exec wrangler d1 create <name>`), update the root binding **and** choose a new ordered-source epoch, then run `pnpm backfill:remote` against that candidate before cutover. Keep the old database for recovery. `pnpm backfill` targets local Wrangler D1; `pnpm backfill:remote` targets production, so double-check the binding before running it.

Monitor `/health/ingestion`: it returns 503 if no checkpoint exists, the checkpoint is older than 30 minutes, or storage fails. `/status` includes the same health result and marks stale ingestion degraded. Never jump/reset an expired or future cursor just to silence an alert; investigate source continuity and rebuild from authoritative repositories if needed.

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
- Contrail server reads execute in-process against D1, with no separate API transport. D1 operations are not cancellable by the page's network deadline.
- OMDb fetches have a **1.8-second** deadline inside a **3.5-second** total enrichment budget. Homepage optional ratings waits are capped at **two seconds** and observe the page deadline. Failures retain the transient-failure/quota backoff.
- Public cache reads/writes have **750 ms** bounded awaits; artwork KV reads have **one-second** bounded awaits. These platform operations are not cancellable, so the limits stop waiting rather than aborting the operation.

Network deadlines cover response-body transfer, not just headers, and use abort signals. Timers are cleared after completion. The eight-second enrichment budget is not a strict end-to-end response limit: cache, artwork, and session/layout work also take time.

Partial/empty homepage results are cached briefly to prevent a failure storm and show a small availability notice; they never replace a healthy result for six hours. Search, reviews, and healthy title/theaters sections remain usable.

These protections do not repair stalled ingestion. Follow the ingestion recovery guidance above; never reset or jump an expired cursor just to silence a health warning.

## Catalog crawling and indexing

- [`static/robots.txt`](static/robots.txt) excludes cast filmographies, frontend API routes, artwork editors, and secondary catalog video/season pages. It does not block title pages, profiles, individual community reviews/lists, or individual submitted videos.
- Empty title pages receive `X-Robots-Tag: noindex, nofollow` and matching HTML metadata. Rating-only reviews or submitted TV descendant videos count as community content. Unknown presence/enrichment failures do not de-index titles.
- Cast, season, and catalog-video pages also have `noindex, nofollow` metadata. Cast/recommendation/filmography/season expansion links use selective `rel="nofollow"`; ordinary community/discovery title links remain followable.
- Title canonical links and `og:url` use the numeric ID plus normalized title slug, without alias slugs, leading zeros, or query parameters. Alias URLs still work; canonical tags consolidate indexing rather than preventing fetches.

Robots exclusions are voluntary, not access controls. `noindex` requires a fetch and cannot remove an already-indexed URL while robots blocks fetching it; `nofollow` is a hint. Blocking unwanted bots requires separate Cloudflare edge rules; these application controls do not impose a spending cap.
