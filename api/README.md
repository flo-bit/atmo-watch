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

## Development

```bash
pnpm api:dev
pnpm --dir api backfill:dev
```
serves at `http://127.0.0.1:8787`

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
