# Workers Toram News

This worker periodically fetches news from https://tw.toram.jp/information/?type_code=all, sends news to Discord channels using webhooks, and generates an RSS feed.

### Database and Storage

- Cloudflare D1: Discord webhooks, latest news, pending news
- Workers KV: RSS feed

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

### [Create a KV namespace](https://developers.cloudflare.com/kv/get-started/#2-create-a-kv-namespace)

```bash
pnpm wrangler kv namespace create feeds
```

### Create wrangler.toml

Copy `wrangler.toml.example` and rename it to `wrangler.toml`.

Replace `database_id` and `id` with your own IDs from above.

```toml
[[d1_databases]]
binding = "TORAM"
database_name = "toram"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[[kv_namespaces]]
binding = "FEEDS"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Deploy

```
pnpm run deploy
```

### [ERROR] Could not resolve "string_decoder"

```
✘ [ERROR] Could not resolve "string_decoder"

    node_modules/.pnpm/sax@1.4.1/node_modules/sax/lib/sax.js:240:25:
      240 │         var SD = require('string_decoder').StringDecoder
          ╵                          ~~~~~~~~~~~~~~~~

  The package "string_decoder" wasn't found on the file system but is built into node.
  Add "node_compat = true" to your wrangler.toml file and make sure to prefix the module name with "node:" to enable Node.js compatibility.


✘ [ERROR] Build failed with 1 error:

  node_modules/.pnpm/sax@1.4.1/node_modules/sax/lib/sax.js:240:25: ERROR: Could not resolve
  "string_decoder"
```

Replace `string_decoder` with `node:string_decoder` in `node_modules/.pnpm/sax@1.4.1/node_modules/sax/lib/sax.js:240:25`.

Run `pnpm run deploy` again.

## Add Discord Webhooks

Go to [Cloudflare D1](https://dash.cloudflare.com/?to=/:account/workers/d1).

Click on the table `webhooks`.

![image](https://github.com/hchengting/workers-toram-news/assets/74168694/4dff4438-b514-4c95-9951-c7817225de7c)

Click `Add data`.

![image](https://github.com/hchengting/workers-toram-news/assets/74168694/6c2b1e03-b78b-4c27-9b19-9af9feabe30b)

Paste your webhook URL (id could be empty) and click `Save`.

![image](https://github.com/hchengting/workers-toram-news/assets/74168694/3ff0522b-5daa-44e8-9991-a7d64cfecfb6)

## RSS Feed

Go to [Cloudflare Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) and create a new worker [(reference)](https://developers.cloudflare.com/workers/get-started/dashboard/).

Paste the following code into `worker.js` and deploy.

```javascript
async function handleGETRequest(request, env) {
    const requestURL = new URL(request.url)
    const { pathname } = requestURL

    try {
        if (!pathname.startsWith('/')) {
            return new Response(`{"status":400,"error":"Bad Request."}`, { status: 400 })
        }

        // Get rss feed from KV
        const feed = await env.FEEDS.get(pathname)

        if (!feed) {
            return new Response(`{"status":404,"error":"Not Found."}`, { status: 404 })
        }

        return new Response(feed, {
            headers: {
                'Content-Type': 'application/xml',
            },
        })
    } catch (err) {
        return new Response(`{"status":500,"error":"Internal Server Error."}`, { status: 500 })
    }
}

export default {
    async fetch(request, env, ctx) {
        switch (request.method) {
            case 'GET':
                return handleGETRequest(request, env)
            default:
                return new Response(`{"status":405,"error":"Method Not Allowed."}`, { status: 405 })
        }
    },
}
```

Under `Settings > Variables`, bind the previously created KV namespace to the worker.

![image](https://github.com/hchengting/workers-toram-news/assets/74168694/1686949d-3663-4c94-8147-9ea3cfa3432c)

The RSS feed is available at: `https://<YOUR_WORKER_NAME>.<YOUR_SUBDOMAIN>.workers.dev/toram`.
