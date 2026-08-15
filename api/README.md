# api.atmo.watch

Cloudflare Worker running the public Contrail service for atmo.watch. Records remain in their authors' AT Protocol repositories; the Worker indexes them in D1 and serves typed XRPC queries.

## Public endpoints

```text
https://api.atmo.watch/.well-known/contrail
https://api.atmo.watch/.well-known/did.json
https://api.atmo.watch/lexicons
https://api.atmo.watch/status
```

Collection reads, profiles, and `watch.atmo.getCursor` are anonymous. Review responses include materialized `likesCount` and `commentsCount`; likes count distinct actors, while comments count records whose `subjectUri` is the review. Like and comment endpoints can also filter by subject. `watch.atmo.notifyOfUpdate` uses AT Protocol service auth with audience `did:web:api.atmo.watch`.

## Initial Cloudflare setup

Create the production database:

```bash
pnpm --dir api exec wrangler d1 create atmo-watch-contrail-g20260815
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

Wrangler stores the local D1 database under `api/.wrangler/`.

## Updating the contract

```bash
pnpm --dir api lexicons:all
pnpm api:check
```

After the production service is live, connect the web app to it from the repository root:

```bash
rm -rf src/lib/contrail contrail.lock.json
pnpm exec contrail connect https://api.atmo.watch \
  --out src/lib/contrail/lexicons \
  --client src/lib/contrail/index.ts \
  --client-types src/lib/contrail/types/index.ts
```

Review and commit the regenerated client, lock, Lexicons, and types.
