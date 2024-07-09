# Workers Toram News

This worker periodically fetches news from https://tw.toram.jp/information and sends news to Discord channels using webhooks.

Since Cloudflare Workers IPs are shared globally, sending news to Discord channels using webhooks may sometimes result in a 429 response due to too many requests.

Therefore, this worker also stores the pending news to be sent in Cloudflare D1.

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

### Deploy

```
pnpm run deploy
```

## Add Discord Webhooks

Go to [Cloudflare D1](https://dash.cloudflare.com/?to=/:account/workers/d1).

Click on the table `webhooks`.

![image](https://github.com/hchengting/workers-toram-news/assets/74168694/4dff4438-b514-4c95-9951-c7817225de7c)

Click `Add data`.

![image](https://github.com/hchengting/workers-toram-news/assets/74168694/6c2b1e03-b78b-4c27-9b19-9af9feabe30b)

Paste your webhook URL (id could be empty) and click `Save`.

![image](https://github.com/hchengting/workers-toram-news/assets/74168694/3ff0522b-5daa-44e8-9991-a7d64cfecfb6)