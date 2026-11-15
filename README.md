<p align="center">
  <a href="https://usepersona.dev"><img src=".github/assets/banner.jpg" alt="Persona" width="100%"></a>
</p>

<h1 align="center">Persona</h1>

<p align="center">
  Your expertise and your rules, as an AI agent people talk to on WhatsApp, Telegram and the web.
</p>

<p align="center">
  <a href="https://usepersona.dev">Website</a> ·
  <a href="https://docs.usepersona.dev">Docs</a> ·
  <a href="https://docs.usepersona.dev/api">API</a> ·
  <a href="apps/docs/content/open-source/development.mdx#deploy">Deploy guide</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License: AGPL-3.0"></a>
</p>

## Features

- **WhatsApp, Telegram and web chat**, with a chat of their own for each person.
- **Your voice and your rules:** instructions, skills, and a choice of models on the Vercel AI Gateway.
- **Memory** for each persona, and notes it keeps by itself.
- **Real work:** apps such as Gmail and Calendar, MCP servers, a vault for logins, a browser and a sandbox.
- **Runs on its own:** schedules, webhooks and app triggers, and it tells the person what came of them.
- **Files and pages:** images, video and voice notes, and pages published on each persona's own address.
- **Credits and billing** with Autumn and Stripe, and an API for everything the app does.

## What's in this repo

- [apps/web](apps/web): the app and the agent.
- [apps/docs](apps/docs): the docs site, [docs.usepersona.dev](https://docs.usepersona.dev).
- [apps/landing](apps/landing): the landing page, [usepersona.dev](https://usepersona.dev).
- [apps/files](apps/files): the files Worker, which serves published files and pictures, on Cloudflare or with Node.

Each app is a project of its own, in one pnpm workspace: run `pnpm install` once, anywhere in the repo. `pnpm dev` at the root starts the app, the docs and the landing; in an app's folder, it starts that app.

## Quick start

You need Node 24, pnpm, Postgres 15 or later, Redis 6 or later, Docker, and an account with each service in [What you need](apps/docs/content/open-source/development.mdx#what-you-need). Persona needs all of them to run.

```bash
git clone https://github.com/usepersona-dev/persona-monorepo.git
cd persona-monorepo/apps/web
pnpm install
cp .env.example .env.local   # fill in your keys
pnpm db:migrate              # the tables; safe to run again
pnpm autumn:push             # the plans in Autumn; safe to run again
pnpm dev                     # http://localhost:3000
```

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fusepersona-dev%2Fpersona-monorepo%2Ftree%2Fmain%2Fapps%2Fweb&project-name=persona&repository-name=persona&demo-title=Read%20the%20deployment%20guide%20first&demo-description=Persona%20needs%20a%20Vercel%20Pro%20team%2C%20a%20Postgres%20database%2C%20and%20accounts%20for%20Clerk%2C%20Autumn%2C%20Supermemory%2C%20Composio%20and%20Cloudflare.%20The%20guide%20shows%20each%20step.&demo-url=https%3A%2F%2Fgithub.com%2Fusepersona-dev%2Fpersona-monorepo%2Fblob%2Fmain%2Fapps%2Fdocs%2Fcontent%2Fopen-source%2Fdevelopment.mdx%23deploy&demo-image=https%3A%2F%2Fraw.githubusercontent.com%2Fusepersona-dev%2Fpersona-monorepo%2Fmain%2F.github%2Fassets%2Fbanner.jpg&env=APP_URL%2CNEXT_PUBLIC_SITE_URL%2CDATABASE_URL%2CNEXT_PUBLIC_CLERK_PUBLISHABLE_KEY%2CCLERK_SECRET_KEY%2CNEXT_PUBLIC_CLERK_SIGN_IN_URL%2CNEXT_PUBLIC_CLERK_SIGN_UP_URL%2CNEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL%2CNEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL%2CAUTUMN_SECRET_KEY%2CAGENT_TOKEN_SECRET%2CSECRETS_KEY%2CAUTOMATIONS_SECRET%2CSUPERMEMORY_API_KEY%2CCOMPOSIO_API_KEY%2CCOMPOSIO_WEBHOOK_SECRET%2CS3_ENDPOINT%2CS3_REGION%2CS3_ACCESS_KEY_ID%2CS3_SECRET_ACCESS_KEY%2CS3_FILES_BUCKET%2CFILES_PREVIEW_URL%2CPUBLISHED_FILES_DOMAIN&envDefaults=%7B%22NEXT_PUBLIC_CLERK_SIGN_IN_URL%22%3A%22%2Fsign-in%22%2C%22NEXT_PUBLIC_CLERK_SIGN_UP_URL%22%3A%22%2Fsign-up%22%2C%22NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL%22%3A%22%2F%22%2C%22NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL%22%3A%22%2F%22%7D&envDescription=Persona%20needs%20each%20of%20these%20to%20run.%20Read%20the%20deployment%20guide%20first%3B%20the%20Environment%20section%20says%20where%20each%20one%20comes%20from.&envLink=https%3A%2F%2Fgithub.com%2Fusepersona-dev%2Fpersona-monorepo%2Fblob%2Fmain%2Fapps%2Fdocs%2Fcontent%2Fopen-source%2Fdevelopment.mdx%23environment)

It needs a Vercel Pro team, since the agent's schedule runs every minute. Read the [deployment guide](apps/docs/content/open-source/development.mdx#deploy) first. Every build migrates its database and pushes the plans itself, and the files Worker deploys to Cloudflare from [apps/files](apps/files).

## Built with

[Next.js](https://nextjs.org) · [eve](https://eve.dev) · [Prisma](https://www.prisma.io) · [Clerk](https://clerk.com) · [Vercel AI Gateway](https://vercel.com/ai-gateway) · [Supermemory](https://supermemory.ai) · [Composio](https://composio.dev) · [Browser Use](https://browser-use.com) · [Autumn](https://useautumn.com) · [Cloudflare R2](https://www.cloudflare.com/developer-platform/products/r2/)

## Docs

- [Quickstart](https://docs.usepersona.dev/quickstart): a persona, a chat and an automation through the API.
- [Architecture](apps/docs/content/open-source/architecture.mdx): how a turn runs, and what is stored where.
- [Development](apps/docs/content/open-source/development.mdx): every setting, the database, and deploying.
- [API](https://docs.usepersona.dev/api): every endpoint.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) to set up and send a change. Found a security issue? Read [SECURITY.md](SECURITY.md) and write to us first.

## License

[AGPL-3.0](LICENSE) © 2026 Odinex, Inc.
