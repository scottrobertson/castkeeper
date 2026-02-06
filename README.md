# Pocketcasts Backup

A Cloudflare Worker that backs up your Pocket Casts listen history and podcast subscriptions to a D1 database. It runs on an hourly cron, and provides a web UI to browse your history, view your subscriptions, and export as CSV.

## Features

- Automatically syncs your listen history every hour
- Backs up your podcast subscriptions with full metadata
- Tracks unsubscribed podcasts with the date they were removed
- Stores everything in Cloudflare D1
- Web interface to browse recent episodes with progress tracking
- Podcasts page showing active and removed subscriptions
- CSV export of your full history
- Manual backup trigger via `/backup`

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

It also fetches your current podcast subscriptions on each run. If you unsubscribe from a podcast, it stays in the database with a `deleted_at` timestamp rather than being removed. If you re-subscribe later, the timestamp is cleared. This gives you a full record of what you've been subscribed to over time.

## Endpoints

| Path | Description |
|---|---|
| `/backup` | Triggers a backup manually |
| `/history?password=YOUR_PASS` | Browse your listen history |
| `/podcasts?password=YOUR_PASS` | View your podcast subscriptions |
| `/export?password=YOUR_PASS` | Download your full history as CSV |

The `/history` and `/export` endpoints are protected by your Pocket Casts password.

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
