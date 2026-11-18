# Contributing to Persona

Thank you for wanting to help. This page says how to get the app running, what we expect from a change, and how to send it.

## Before you start

- A small fix: open a pull request.
- A bigger change, or a new feature: open an issue first, so we can agree on its shape before you write it.
- A security problem: do not open an issue. Read [SECURITY.md](SECURITY.md) and write to us.

Everyone here follows our [Code of Conduct](CODE_OF_CONDUCT.md).

## Set up

Persona needs real services to run: a Postgres database, a Redis, Clerk, a model key, Autumn, Supermemory, Composio, a bucket on any storage that speaks S3 (Cloudflare R2, AWS S3 or MinIO) and a domain for published files, plus Browser Use for the browser tools. [Development](https://docs.usepersona.dev/open-source/development) has the full list and every environment variable.

```bash
cd apps/web
pnpm install
cp .env.example .env.local   # fill it in
pnpm db:migrate              # once: the tables
pnpm autumn:push             # once: the plans in Autumn
pnpm dev                     # the app and the agent on http://localhost:3000
```

Both are safe to run again at any time.

## How the code is laid out

The app is in `apps/web`. The docs site in `apps/docs` and the landing page in `apps/landing` are Next.js projects of their own, and `apps/files` is the files Worker. Inside `apps/web`:

- `app/` holds the pages, and the REST API in `app/api`.
- `agent/` is the eve agent: `instructions/`, `tools/`, `channels/`, `hooks/`, `schedules/`.
- `usecases/<area>.ts` holds every business rule. A use case returns a `Result`, and throws only on a fault, such as a missing environment variable or a vendor that is down. Routes, pages and agent tools call use cases and nothing else.
- `lib/<vendor>.ts` talks to one third party and never to the database.
- `prisma/contract.prisma` is the schema, and `migrations/` its history.

The rules we hold in review:

- Put a rule in one place. When the API and an agent tool do the same thing, both call the same use case.
- Write the simple version. No layers, flags or fallbacks for cases that do not exist yet.
- Long lines are fine. Comments say why, or explain a vendor's quirk; they do not repeat the code.
- A schema change is a new migration: change `prisma/contract.prisma`, run `pnpm contract:emit`, then `pnpm prisma migration plan --name <slug>`. Read the plan before you send it.

## Before you send a pull request

```bash
pnpm exec next typegen && pnpm typecheck   # the route types come from next typegen
pnpm lint
pnpm test                 # unit tests: they need no keys
pnpm test:integration     # uses the real database, and some tests call real models: see Development first
```

- Keep a pull request to one change, and say what it does and why.
- Add a screenshot for a change people can see.
- When behavior changes, change its page in `apps/docs` too, in the same pull request.

## License of your contribution

Persona is published under the [GNU Affero General Public License v3.0](LICENSE). By sending a pull request you confirm that you wrote the change or have the right to send it, and your contribution is licensed under the same terms.
