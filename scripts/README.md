# Project scripts

Run these scripts from the repository root with Node 22.19 or newer.

## Open Graph image

Generate `static/og.png` from the current weekly trending movies and shows on TMDB. The renderer uses CSS 3D transforms in Chromium and requires `TMDB_ACCESS_TOKEN` or `TMDB_API_KEY` in `.env`.

```sh
pnpm og:generate
```

If Playwright's Chromium is unavailable, run `pnpm exec playwright install chromium` or point `OG_BROWSER_PATH` to a Chromium-based browser.

## Video curation

These scripts discover and review YouTube videos, then submit the accepted records to AT Protocol repositories.

### 1. Find and review videos

`find-videos.ts` resolves each target through TMDB and first gives its cast, characters, creators, keywords, seasons, and episodes to a pi SDK search-planning agent. That agent designs title-specific searches such as character best-scenes queries, season recaps, iconic episode clips, interviews, production material, and analysis. The script prints and saves this plan before running any YouTube searches.

It then searches YouTube with `youtubei.js`, loads the real view count and available stream resolution, applies hard filters, and gives the remaining candidates to a second pi agent for final curation. Individual scenes and clips are treated as first-class content: relevant high-quality scene uploads are allowed even when the channel is unofficial. The reviewing agent can do extra web or YouTube research before assigning a TV video to a season or episode.

The reviewer is asked to select or reject every candidate with a reason; anything it omits is safely skipped and recorded as `unclassified`. Both mechanical and AI rejection details are saved under `discovery.filters.rejections` and `discovery.review.rejections`, so large reductions are auditable. The accepted result contains records matching `watch.atmo.alpha.video`.

Pi uses credentials already configured for the local pi installation. Both planning and review default to `openai-codex/gpt-5.6-luna` at `high`; `--model` and `--thinking` can override them. No separate OpenAI API integration is used.

```sh
# Required: set TMDB_ACCESS_TOKEN (recommended) or TMDB_API_KEY in .env
pnpm videos:find -- --movie 550 --limit 20
pnpm videos:find -- --show 1396 --seasons 1-5 --limit 40

# Multiple targets produce one JSON file each
pnpm videos:find -- --movie 550 --movie "The Matrix" --show 1396

# Override the default gpt-5.6-luna:xhigh model if needed
pnpm videos:find -- --show 1396 --model anthropic/claude-sonnet-4-6 --thinking high
```

Files are written to `data/video-submissions/` by default. Discovery work is checkpointed under `data/video-submissions/.work/`: the search plan, every five completed YouTube queries, every metadata batch, and the completed AI review are saved atomically. Rerun the same command after an interruption to resume automatically. Changed options start a new checkpoint; use `--fresh` to explicitly discard saved work.

Useful controls include:

- `--limit`: maximum accepted videos **per movie/show**
- `--candidate-limit`: maximum inspected/reviewed candidates (dynamic default, maximum 500)
- `--query-limit`: number of AI-planned YouTube searches (default 50, maximum 200)
- `--min-views`, `--min-height`, `--min-duration`: hard pre-review filters (`--min-views` defaults to 2500)
- `--seasons 1,3-5`: limit a TV run to particular seasons
- `--verbose`: show the planning and review agents' streamed text
- `--fresh`: discard the target's saved discovery checkpoint

Use TMDB IDs for unambiguous targets. Run `pnpm videos:find -- --help` for every option.

### 2. Upload submissions

Use an AT Protocol app password rather than a primary password.

### One account

```sh
export ATPROTO_IDENTIFIER=video-bot.example.com
export ATPROTO_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
pnpm videos:upload -- data/video-submissions
```

`--account`, `--password-env`, and `--service` can replace those defaults.

### Multiple accounts

Copy [`video-accounts.example.json`](video-accounts.example.json), set each account's `passwordEnv` in the shell or `.env`, and run:

```sh
export ATPROTO_APP_PASSWORD_1=xxxx-xxxx-xxxx-xxxx
export ATPROTO_APP_PASSWORD_2=yyyy-yyyy-yyyy-yyyy
pnpm videos:upload -- data/video-submissions --accounts ./video-accounts.json
```

Passwords never need to appear in the account JSON. Accounts upload concurrently, while each account writes serially. The default `--split-by title` keeps every record for one movie or TV series on the same account and greedily balances title groups. Use `--split-by file` or `--split-by record` for different partitioning.

Before writing, the uploader validates every record, removes duplicate YouTube IDs, and checks every participating repository for existing video records. It uses:

- a configurable per-account delay (`--interval-ms`, default 2500 ms),
- proactive pacing when AT Protocol rate-limit headers are nearly exhausted,
- `Retry-After`/`RateLimit-Reset` aware retries for HTTP 429 responses,
- an atomic `.upload-state.json` checkpoint for safe resume after interruption.

Preview the partition without authenticating or writing:

```sh
pnpm videos:upload -- data/video-submissions --accounts ./video-accounts.json --dry-run
```

Use `--force` only when intentionally ignoring both the checkpoint and existing-record checks. Run `pnpm videos:upload -- --help` for every option.
