# Persona docs

The documentation site for Persona. It is a [Fumadocs](https://fumadocs.dev) app on Next.js, in its own repository beside `webapp` and `landing`.

```bash
pnpm install
pnpm dev        # http://localhost:3002
```

## Write a page

Pages are MDX files in [`content/docs/`](./content/docs). The frontmatter is `title` and `description`. The description also goes on the social card and in search results, so write it as a full sentence. Do not start a page with a `#` heading: the layout shows the title.

[`content/docs/meta.json`](./content/docs/meta.json) sets the order of the sidebar. A page that is not in the list does not show in the sidebar.

```
content/docs/
  meta.json         sidebar order
  index.mdx         Introduction
  quickstart.mdx    Quickstart
  concepts.mdx      Concepts
  personas.mdx      Personas
  channels.mdx      Channels
  architecture.mdx  Architecture
  development.mdx   Development
  api.mdx           API
```

The docs describe the code in the `webapp` repository. When a feature changes there, change its page here.

## What the site makes

- `/og/docs/*`: a social card for each page, made with `next/og`.
- `/llms.txt`, `/llms-full.txt` and `/llms.mdx/docs/*`: plain-text copies of the pages for LLMs.
- Search: Orama search at `/api/search`, and an "Ask AI" panel at `/api/chat`.

"Ask AI" calls a model through the Vercel AI Gateway. It needs a `VERCEL_OIDC_TOKEN` (from `vercel env pull` on a linked project) or an `AI_GATEWAY_API_KEY` in `.env.local`. Without one, the rest of the site works and the panel shows an error.
