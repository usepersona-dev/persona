# Security

Persona runs AI agents that hold people's chats, files, credentials and connected accounts. A hole here hurts real people, so we want to hear about it first.

## Report a problem

Email **info@usepersona.dev** with "Security" in the subject. Tell us:

- What you found and where (a URL, a file and line, an API route).
- How to see it again, step by step.
- What someone could do with it.

Do not open a public issue for a security problem, and do not test against accounts, chats or data that are not yours. Make a free account and your own persona to test with.

## What happens next

- We answer within three business days, and we say what we found and when a fix lands.
- We fix confirmed problems in the hosted service first, then publish the change here.
- We credit you in the release note if you want that.
- We do not pay bounties.

## Scope

- This repository (the app, and the agent under `agent/`), and the `docs` and `landing` repositories.
- The hosted service: `app.usepersona.dev`, `files.usepersona.dev` and the agents people reach on WhatsApp, Telegram and the web.

Problems in a third-party service we use (a model provider, Clerk, Vercel, Cloudflare, Meta, Telegram) go to that service; tell us too if our use of it is the problem.

A persona that says something it should not is a product problem, not a security one, unless it leaks data or takes an action it was not asked for. Report those the same way; we read them with the same care.

## Supported versions

The hosted service and the `main` branch. A fork you run yourself is yours to keep current; we publish fixes on `main` and in the release notes.
