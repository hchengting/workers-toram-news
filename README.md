# Workers Toram News

This Discord bot regularly fetches announcements from https://tw.toram.jp/information and sends them to the Discord channel.

Hosted on Cloudflare Workers.

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

Replace `database_id` with your own id from above.

```toml
[[d1_databases]]
binding = "TORAM"
database_name = "toram"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Deploy

```bash
pnpm run deploy
```

## Setup Discord Bot

Follow [Setting up a bot application | discord.js Guide (discordjs.guide)](https://discordjs.guide/preparations/setting-up-a-bot-application.html) to create your Discord bot.

### [Add Discord Bot Token & Public Key to Workers](https://developers.cloudflare.com/workers/configuration/secrets/)

#### For Local Development

Copy `.dev.vars.example` and rename it to `.dev.vars`.

Fill in the bot token and public key.

```env
DISCORD_BOT_TOKEN=""
DISCORD_PUBLIC_KEY=""
```

#### For Deployed Workers

```bash
pnpm wrangler secret put DISCORD_BOT_TOKEN
pnpm wrangler secret put DISCORD_PUBLIC_KEY
```

### Register Slash Commands

Fill in the bot token and application id in `src/register.js`.

```javascript
const token = ''
const applicationId = ''
```

```bash
node src/register.js
```

### Change Default Install Settings

Go to [Discord Developer Portal — My Applications](https://discord.com/developers/applications).

Click on your bot application and open the Installation page.

Select `Guild Install`.

Select the `bot` scope.

Select `Embed Links`, `Send Messages` permissions.

![image](https://github.com/user-attachments/assets/b10f9f8a-5734-44bf-8272-1c91477cd8d7)

### Invite Bot to Server

Invite bot to the server by visiting the install link.

### Change Interactions Endpoint URL

Go to [Discord Developer Portal — My Applications](https://discord.com/developers/applications).

Click on your bot application and open the General Information page.

Update this field to use your Cloudflare Workers URL.

For example, `https://workers-toram-news.<YOUR_SUBDOMAIN>.workers.dev`.

![image](https://github.com/user-attachments/assets/b50da751-f31b-45bd-82f2-7bf30b762b86)

### Subscribe to Toram Annoucements

Use `/subscribe` command in the channel.

![image](https://github.com/user-attachments/assets/dcb8a948-b47a-4b4e-94ca-3b19d8770742)

## References

- [Discord Developer Portal — Documentation — Hosting on Cloudflare Workers](https://discord.com/developers/docs/tutorials/hosting-on-cloudflare-workers)
- [discord/cloudflare-sample-app: Example discord bot using Cloudflare Workers (github.com)](https://github.com/discord/cloudflare-sample-app)
- [@discordjs/rest](https://discord.js.org/docs/packages/rest/main)