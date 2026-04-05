# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this?

Castkeeper is a Cloudflare Worker that backs up Pocket Casts listening data (episodes, podcasts, bookmarks) to a D1 database. It runs on an hourly cron schedule and includes a web UI built with Hono and JSX.

## Commands

- `npm run dev` — start local dev server (requires `wrangler.toml` and `.dev.vars`)
- `npm run deploy` — deploy to Cloudflare
- `npm run test` — run all tests
- `npx vitest run test/api.test.ts` — run a single test file
- `npm run typecheck` — TypeScript type checking
- `npx wrangler d1 migrations create <name>` — create a new migration
- `npx wrangler d1 migrations apply castkeeper --local` — apply migrations locally

## Architecture

**Worker entry point** (`src/index.tsx`): Exports three handlers:
- `fetch` — Hono web app serving the UI and API routes
- `scheduled` — hourly cron that enqueues a `sync-podcasts` message
- `queue` — processes backup messages from the Cloudflare Queue

**Backup pipeline** (`src/backup.ts`): Backups fan out across a Cloudflare Queue to avoid subrequest limits. The flow is:
1. `sync-podcasts` — fetches podcast list and bookmarks, saves them, enqueues one `sync-podcast` message per podcast
2. `sync-podcast` — syncs episodes for a single podcast, tracks progress, enqueues `sync-history` when all done
3. `sync-history` — fetches listen history timestamps year-by-year and updates `played_at` on episodes

**Data layer** (`src/db.ts`): All database operations use Drizzle ORM with D1. Writes are batched in chunks of 50 via `batchExecute`. Schema is in `src/schema.ts`.

**Pocket Casts API** (`src/api.ts`): Raw API calls. Auth tokens come from `src/login.ts`.

**UI components** (`src/components/`): Server-rendered JSX via Hono's JSX support (`jsxImportSource: "hono/jsx"`). No client-side framework.

**Types** (`src/types.ts`): Pocket Casts API response types and the `Env` binding interface (D1, Queue, secrets).

## Testing

Tests use `vitest` with `@cloudflare/vitest-pool-workers` to run in the Workers runtime. The test config (`vitest.config.ts`) sets up a local D1 database with migrations applied automatically. Test bindings include mock credentials (`test@example.com` / `test-password`).

## Database

SQLite via Cloudflare D1. Migrations live in `migrations/` and are plain SQL files managed by `wrangler d1 migrations`. Schema is defined in Drizzle (`src/schema.ts`) but migrations are written by hand.

Soft deletes: unsubscribed podcasts and removed bookmarks get a `deleted_at` timestamp rather than being removed.
