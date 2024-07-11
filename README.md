# Workers Toram News

This worker periodically fetches news from https://tw.toram.jp/information and sends news to Discord channels.

## Prerequisites

- Node.js: v18.12.0
- pnpm: v9.1.2

## How to Deploy

### Clone the Repository

```bash
git clone https://github.com/hchengting/workers-toram-news.git
cd workers-toram-news
pnpm install
pnpm wrangler login
```

### [Create a D1 database](https://developers.cloudflare.com/d1/get-started/#3-create-a-database)

```bash
pnpm wrangler d1 create toram
```

### [Initialize database](https://developers.cloudflare.com/d1/get-started/#configure-your-d1-database)

```bash
pnpm wrangler d1 execute toram --remote --file=./schema.sql
```

### Create wrangler.toml

Copy `wrangler.toml.example` and rename it to `wrangler.toml`.

Replace `database_id` with your own ID from above.

```toml
[[d1_databases]]
binding = "TORAM"
database_name = "toram"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Add Discord Bot Token

```bash
pnpm wrangler secret put DISCORD_BOT_TOKEN
```

### Deploy

```bash
pnpm run deploy
```

## Add Discord Channels

Go to [Cloudflare D1](https://dash.cloudflare.com/?to=/:account/workers/d1).

Click on the table `channels`.

![image](https://github.com/hchengting/workers-toram-news/assets/74168694/42ed4561-15d2-4bbd-964b-4ac399010a1a)

Click `Add data`.

![image](https://github.com/hchengting/workers-toram-news/assets/74168694/7b98e222-123d-422e-a7de-c51c53c0ffd3)

Paste your channel id and click `Save`.

![image](https://github.com/hchengting/workers-toram-news/assets/74168694/838a0191-012a-4232-b7a1-20089240a7c7)