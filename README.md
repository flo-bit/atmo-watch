# atmo.watch

review movies and tv shows with your atmosphere account, using popfeed.social's lexicons.

## API Worker

The public Contrail API is a separate Cloudflare Worker under [`api/`](api/README.md). Use `pnpm api:dev`, `pnpm api:check`, and `pnpm api:deploy` from the repository root.

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
