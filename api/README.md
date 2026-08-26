# api.atmo.watch

Cloudflare Worker running the public Contrail service for atmo.watch. Records remain in their authors' AT Protocol repositories; the Worker indexes them in D1 and serves typed XRPC queries.

## Public endpoints

```text
https://api.atmo.watch/.well-known/contrail
https://api.atmo.watch/.well-known/did.json
https://api.atmo.watch/lexicons
https://api.atmo.watch/status
```

Collection reads, profiles, and `watch.atmo.getCursor` are anonymous. Profile responses include both Bluesky and Popfeed profiles when available. Review responses include materialized `likesCount` and `commentsCount`; `watch.atmo.review.listWrittenRecords` filters out records whose text is empty or whitespace, and `watch.atmo.review.getRatingSummary` calculates a title's rating count and average directly in D1. `watch.atmo.review.getTopRated` returns the twenty highest-rated TMDB movies and shows from the last 30 days, counting at most one rating per actor and weighting each title with three prior ratings of 5/10. List responses include `itemsCount`, `likesCount`, and `commentsCount`, plus optional relation hydration. Likes count distinct actors, while comments count records whose `subjectUri` is the review or list. List items can be filtered by list URI, media identifiers, work type, list type, status, and date. `watch.atmo.notifyOfUpdate` uses AT Protocol service auth with audience `did:web:api.atmo.watch`.

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
