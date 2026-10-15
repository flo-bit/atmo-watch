# api.atmo.watch

Cloudflare Worker running the public Contrail service for atmo.watch. Records remain in their authors' AT Protocol repositories; the Worker indexes them in D1 and serves typed XRPC queries.

## Public endpoints

```text
https://api.atmo.watch/.well-known/contrail
https://api.atmo.watch/.well-known/did.json
https://api.atmo.watch/lexicons
https://api.atmo.watch/status
https://api.atmo.watch/health/ingestion
```

`/health/ingestion` returns an uncached **503** if the ingestion checkpoint is missing,
invalid, unreadable, or more than 30 minutes old; otherwise it returns **200**.
Use this endpoint for ingestion uptime checks, rather than `/health` (process liveness).
`/status` also includes this check in `ingestion` and reports `status: "degraded"`
when it fails. Checkpoint age uses `source_position.updated_at`, not the Jetstream
sequence number or the date of the newest review. This makes a stuck importer visible
well before the upstream live-retention window expires. External alert delivery must
be configured separately.

If ingestion reports `JetstreamLiveHistoryExpiredError`, do not simply clear or jump
its cursor: doing so skips the missing interval. Preserve a D1 backup, capture a fresh
source boundary, resync repositories (retaining unavailable accounts), reconcile
missing records only through authoritative PDS responses, then replay from that
pre-resync boundary. Verify multiple subsequent scheduled checkpoints advance.
Completed discovery/backfill tasks must be explicitly requeued for a recovery resync;
a normal resumable backfill alone will skip them.

Collection reads, profiles, and `watch.atmo.getCursor` are anonymous. Profile responses include both Bluesky and Popfeed profiles when available. Review responses include materialized `likesCount` and `commentsCount`; `watch.atmo.review.listWrittenRecords` filters out records whose text is empty or whitespace, and `watch.atmo.review.getRatingSummary` calculates a title's rating count and average directly in D1. `watch.atmo.review.getTopRated` returns the twenty highest-rated TMDB movies and shows from the last 30 days, counting at most one rating per actor and weighting each title with three prior ratings of 5/10. List responses include `itemsCount`, `likesCount`, and `commentsCount`, plus optional relation hydration. Likes count distinct actors, while comments count records whose `subjectUri` is the review or list. List items can be filtered by list URI, media identifiers, work type, list type, status, and date. `watch.atmo.notifyOfUpdate` uses AT Protocol service auth with audience `did:web:api.atmo.watch`.

### Catalog community presence

`watch.atmo.review.getCommunityPresence` accepts a movie/TV `creativeWorkType` and positive
numeric `tmdbId`. It returns `hasReviews`, `hasVideos`, and `hasDescendantVideos` from a
single bounded statement using `EXISTS` and the existing queryable-field identifier
indexes. Reviews include rating-only and text-only records; deleted/unavailable records
are excluded. TV descendants are checked by series ID, including season zero. There is
no profile hydration, rating aggregation, or new schema/migration.

The response uses `Cache-Control: no-store`; the frontend owns its five-minute anonymous
presence cache so authenticated publishing flows can bypass cached negatives. Deploy
this API before the frontend, then refresh the production provider lock/client with
`pnpm contrail:update:prod`. The method is anonymous and adds no OAuth permissions.

## Initial Cloudflare setup

Create the production database:

```bash
pnpm --dir api exec wrangler d1 create atmo-watch-contrail-g20260819
```

Copy the returned database ID into `api/wrangler.jsonc`, then deploy and backfill:

```bash
pnpm api:deploy
pnpm --dir api backfill:remote
```

The custom domain route requires `atmo.watch` to be available in the same Cloudflare account.

## Development

```bash
pnpm api:dev
pnpm --dir api backfill:dev
```

Contrail's local development server stores its SQLite database under the repository's ignored `.contrail/` directory and serves the source contract at `http://127.0.0.1:8787`. It does not alter the production provider lock.

## Updating the contract

```bash
pnpm --dir api lexicons:all
pnpm api:check
```

Regenerate the web app's source API from the repository root before deployment:

```bash
pnpm contrail:generate
pnpm api:check
pnpm api:deploy
pnpm contrail:update:prod
```

The source connection updates types and local client metadata without changing the production lock. The final command reconnects to the deployed service and updates that lock. Review and commit the regenerated client, lock, Lexicons, and types.
