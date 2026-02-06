# Pocketcasts Backup

A Cloudflare Worker that backs up your Pocket Casts listen history to a D1 database. It runs on an hourly cron, and provides a web UI to browse your history and export it as CSV.

## Features

- Automatically syncs your listen history every hour
- Stores episode data in Cloudflare D1
- Web interface to browse recent episodes with progress tracking
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

6. Deploy:

```bash
npm run deploy
```

The database table is created automatically on the first backup run.

## How it works

The Pocket Casts API only returns the most recent 100 episodes per request. The worker runs hourly to make sure new listens are captured before they fall outside that window. Each run upserts episodes into D1, so duplicates are handled automatically and your history grows over time.

## Endpoints

| Path | Description |
|---|---|
| `/backup` | Triggers a backup manually |
| `/history?password=YOUR_PASS` | Browse your listen history |
| `/export?password=YOUR_PASS` | Download your full history as CSV |

The `/history` and `/export` endpoints are protected by your Pocket Casts password.

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
