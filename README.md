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

### Add Bot to Server

Go to [Discord Developer Portal — My Applications](https://discord.com/developers/applications).

Click on your bot application and open the OAuth2 page.

#### OAuth2 URL Generator

Select the `bot` scope.

![image](https://github.com/user-attachments/assets/f0d5ff49-e2dc-4477-9fbc-cb3698cff60c)

Select `Send Messages`, `Embed Links` permissions.

![image](https://github.com/user-attachments/assets/56911834-dc3d-47ce-a07e-5a6c5cb1ca6d)

Invite bot to the server by visiting the generated URL.

![image](https://github.com/user-attachments/assets/cebc4bdc-f9c0-460c-9e9a-23fe3bb28639)

#### Change Default Install Link

Go to [Discord Developer Portal — My Applications](https://discord.com/developers/applications).

Click on your bot application and open the Installation page.

Select `Custom URL` and paste the generated URL.

![image](https://github.com/user-attachments/assets/4e2cd120-b784-4077-b495-571a999bdc9a)

### Change Interactions Endpoint URL

Go to [Discord Developer Portal — My Applications](https://discord.com/developers/applications).

Click on your bot application and open the General Information page.

Update this field to use your Cloudflare Workers URL.

For example, `https://workers-toram-news.<YOUR_SUBDOMAIN>.workers.dev`.

![image](https://github.com/user-attachments/assets/b50da751-f31b-45bd-82f2-7bf30b762b86)

### Subscribe to Toram Annoucements

Use `/subscribe` command in the channel.

![image](https://github.com/user-attachments/assets/80ca957d-3e96-4ab5-97ac-5de61b9e1745)

## References

- [Discord Developer Portal — Documentation — Hosting on Cloudflare Workers](https://discord.com/developers/docs/tutorials/hosting-on-cloudflare-workers)
- [discord/cloudflare-sample-app: Example discord bot using Cloudflare Workers (github.com)](https://github.com/discord/cloudflare-sample-app)
- [@discordjs/rest](https://discord.js.org/docs/packages/rest/main)