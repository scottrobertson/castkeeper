# Pocketcasts Backup

A Cloudflare Worker that backs up your Pocket Casts data to a D1 database. Runs on an hourly cron with a web UI to browse everything.

<img width="3984" height="2724" alt="2026-02-06 at 15 46 46@2x" src="https://github.com/user-attachments/assets/9f113b25-06f8-4472-9edc-4e0adfecbf69" />

## What gets backed up

- **Episodes** — your full listen history, including play progress, duration, and starred status
- **Podcasts** — all your subscriptions with metadata. Unsubscribed podcasts are kept with a removal date rather than deleted.
- **Bookmarks** — all your bookmarks with timestamps. Deleted bookmarks are kept with a removal date rather than deleted.

Everything is stored in Cloudflare D1 and synced automatically every hour.

## Features

- Web UI with episodes, podcasts, and bookmarks pages
- Pagination on the episodes page
- CSV export of your full episode history
- Manual backup trigger via the UI or `/backup`

## Deploy to Cloudflare

### Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Node.js](https://nodejs.org/) 18+
- A [Pocket Casts](https://pocketcasts.com/) account

### Steps

1. Clone the repo and install dependencies:

```bash
git clone https://github.com/scottrobertson/pocketcast-backup.git
cd pocketcast-backup
npm install
```

2. Log in to Cloudflare:

```bash
npx wrangler login
```

3. Create a D1 database:

```bash
npx wrangler d1 create pocketcasts-history
```

4. Copy the example wrangler config and add your database ID from the previous step:

```bash
cp wrangler.toml.example wrangler.toml
```

Update the `database_id` in `wrangler.toml` with the ID output from step 3.

5. Set your Pocket Casts credentials as secrets:

```bash
npx wrangler secret put EMAIL
npx wrangler secret put PASS
```

6. Apply the database migrations and deploy:

```bash
npx wrangler d1 migrations apply pocketcasts-history --remote
npm run deploy
```

## How it works

The Pocket Casts API only returns the most recent 100 episodes per request. The worker runs hourly to make sure new listens are captured before they fall outside that window. Each run upserts episodes into D1, so duplicates are handled automatically and your history grows over time.

It also fetches your current podcast subscriptions and bookmarks on each run. If you unsubscribe from a podcast or delete a bookmark, it stays in the database with a `deleted_at` timestamp rather than being removed. If you re-subscribe or re-add later, the timestamp is cleared. This gives you a full record of what you've been subscribed to and bookmarked over time.

## Endpoints

| Path | Description |
|---|---|
| `/backup` | Triggers a backup manually |
| `/episodes?password=YOUR_PASS` | Browse your episodes with pagination |
| `/podcasts?password=YOUR_PASS` | View your podcast subscriptions |
| `/bookmarks?password=YOUR_PASS` | View your bookmarks |
| `/export?password=YOUR_PASS` | Download your full episode history as CSV |

All endpoints except `/backup` are protected by your Pocket Casts password. The old `/history` path redirects to `/episodes`.

## Database Migrations

Schema changes are managed with [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) in the `migrations/` directory.

To create a new migration:

```bash
npx wrangler d1 migrations create <migration-name>
```

To apply migrations:

```bash
# Local
npx wrangler d1 migrations apply pocketcasts-history --local

# Production
npx wrangler d1 migrations apply pocketcasts-history --remote
```

## Local Development

Copy the example config and create a `.dev.vars` file with your credentials:

```bash
cp wrangler.toml.example wrangler.toml
cp .env.example .dev.vars
```

Edit `.dev.vars` with your Pocket Casts email and password, then start the dev server:

```bash
npm run dev
```
