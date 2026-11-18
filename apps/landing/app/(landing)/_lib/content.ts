// The landing's words and links, in page order

export const APP = `${process.env.NEXT_PUBLIC_APP_URL}`
export const SIGN_UP = `${process.env.NEXT_PUBLIC_APP_URL}/sign-up`
export const DOCS = `${process.env.NEXT_PUBLIC_DOCS_URL}`
export const GITHUB = "https://github.com/usepersona-dev/persona-monorepo"

export const CHANNELS = [
  { id: "whatsapp", name: "WhatsApp" },
  { id: "telegram", name: "Telegram" },
  { id: "slack", name: "Slack" },
  { id: "imessage", name: "iMessage" },
] as const

export type ChannelId = (typeof CHANNELS)[number]["id"]
export type AppId = "gmail" | "googlecalendar" | "googlesheets" | "slack" | "notion"

export const APP_NAMES: Record<AppId, string> = { gmail: "Gmail", googlecalendar: "Google Calendar", googlesheets: "Google Sheets", slack: "Slack", notion: "Notion" }

// The menu: the How-to chapters first, then the rest
export const HOW_LINKS = [
  { href: "#build", label: "Build" },
  { href: "#sell", label: "Sell" },
  { href: "#scale", label: "Scale" },
]

export const HERO = {
  first: "Welcome to the",
  second: "agent factory",
  lines: ["Make AI agents for your business, your family, or your customers.", "Each one has its own skills, apps and schedule."],
  button: "Build your first agent",
  free: "No card needed. Free to start.",
  chatsOn: "Your agents chat on",
  figure: "Fig. 01 — The making of an agent",
  caption: "Every good helper was taught by someone.",
}

// The app window section: each step shows one scene of the window, with a caption under it
export const INSIDE = {
  eyebrow: "Inside the factory",
  title: "One canvas for all your agents.",
  lede: "Open an agent to talk to it, write its rules, add skills, connect apps and set automations.",
  steps: [
    { scene: "chat", label: "Talk to an agent", caption: "Front Desk sets its own schedule from one sentence in the chat." },
    { scene: "rules", label: "Write the rules", caption: "Named rules in plain words. Each one switches on and off." },
    { scene: "skills", label: "Add skills", caption: "Procedures in Markdown, written by you or installed from skills.sh." },
    { scene: "apps", label: "Connect apps", caption: "Gmail, Google Calendar, Slack, Notion and hundreds more." },
    { scene: "automations", label: "Set automations", caption: "Tasks that run on a schedule. The agent writes first." },
    { scene: "usage", label: "Watch them all", caption: "Usage of every agent, by day or by hour." },
  ],
} as const

export type Scene = (typeof INSIDE.steps)[number]["scene"]

export const PARTS = {
  eyebrow: "The whole agent",
  title: ["Everything an agent needs.", "All of it its own."],
  lede: "Ten parts. Every agent you make gets its own set.",
  items: [
    { panel: "models", label: "Models", title: "A model for each job.", text: "Give an agent up to five models and say when to use each. A new agent starts with two: one for chats and one for scheduled tasks." },
    { panel: "rules", label: "Instructions", title: "Your rules, in plain words.", text: "Instructions are named rules that an agent follows in every conversation. Each rule switches on and off by itself." },
    { panel: "skills", label: "Skills", title: "Skills for the real work.", text: "A skill is a procedure in Markdown, with its files. Write your own, or install one from skills.sh." },
    { panel: "apps", label: "Integrations", title: "The apps people already use.", text: "Gmail, Google Calendar, Slack, Notion, GitHub and hundreds more. Any MCP server connects by its URL." },
    { panel: "automations", label: "Automations", title: "Work that starts by itself.", text: "An automation is a task an agent does on a schedule, once or again and again. The result goes to the chat the task came from." },
    { panel: "triggers", label: "Triggers and webhooks", title: "A new email can start a task.", text: "A trigger runs a task when something happens in a connected app. A webhook does the same for a form, a store or Zapier." },
    { panel: "channels", label: "Channels", title: "In the apps people already chat in.", text: "People reach an agent on WhatsApp, Telegram, Slack, iMessage or the web, with nothing to download. An agent can also write first." },
    { panel: "notes", label: "Memory and notes", title: "An agent that remembers.", text: "Each agent has its own memory of the people in its chats, and keeps its own notes, such as lists and drafts." },
    { panel: "vault", label: "Vault", title: "Logins stay sealed.", text: "The vault holds logins, cards and API keys. People type them on a form, never in the chat, and nobody can read them back." },
    { panel: "api", label: "API", title: "One API under everything.", text: "The app is a client of the REST API. Most of what the app does, you can do over HTTP with an API key." },
  ],
} as const

export type PartPanel = (typeof PARTS.items)[number]["panel"]

// The How-to guide. Kept true: copies are independent (no update-all), and creators bill their own customers.
export const HOW_TO = {
  eyebrow: "How to",
  title: "How to build a business of personal AI agents.",
  lede: "Three chapters: build one agent, give one to each customer, and keep them all running.",
  note: "Each chapter takes a few minutes. The docs have every detail.",
  chapters: [
    {
      id: "build",
      short: "Build",
      title: "How to build an agent",
      text: "Start with one agent and one job. Teach it in plain words, then give it the apps and the schedule it needs.",
      picture: { src: "/art/making.webp", width: 800, height: 598, position: "center 55%", alt: "A painting of two artisans who lift a new white cloud agent out of a bowl of mist" },
      steps: [
        { title: "Create a project", text: "The first agent comes with it, named after the project." },
        { title: "Write its rules", text: "Plain words, one rule at a time. Switch any rule off." },
        { title: "Add skills and apps", text: "Your own procedures, skills from skills.sh, and the apps it works in.", apps: ["gmail", "googlecalendar", "slack", "notion"] as AppId[] },
        { title: "Give it a schedule", text: "A morning brief, a weekly report. The agent writes first." },
      ],
      more: { href: "/quickstart", label: "Read the quickstart" },
    },
    {
      id: "sell",
      short: "Sell",
      title: "How to sell agents",
      text: "You bring the audience or the clients. Persona makes a personal agent for each of them and keeps it running. You set the price.",
      picture: { src: "/art/market.webp", width: 1000, height: 1340, position: "center 74%", alt: "A painting of a market stall where a maker hands a cloud agent to a customer, and townspeople walk away with their own" },
      steps: [
        { title: "Make one agent great", text: "Put what you know into its rules and skills. Test it in the chat." },
        { title: "Give each customer their own", text: "Duplicate it for each person. Rules and skills come along; memory and chats start fresh." },
        { title: "Link their chat", text: "Each customer links their chat app with a short code.", channels: true },
        { title: "Set your price", text: "You decide what they pay, and you bill them yourself." },
      ],
      more: { href: "/personas#copies", label: "How copies work" },
    },
    {
      id: "scale",
      short: "Scale",
      title: "How to scale",
      text: "One agent or three hundred. Keep every agent updated and engaging, and see what each one uses.",
      picture: { src: "/art/dusk.webp", width: 2400, height: 1019, position: "16% 62%", alt: "A painting of a dusk sky full of small cloud agents over a hill town" },
      steps: [
        { title: "See them all in one place", text: "A project holds all your agents on one canvas." },
        { title: "Keep each one updated", text: "Change any agent's rules, skills or schedule in the app, or from your own code over the API." },
        { title: "Keep them engaging", text: "Automations let each agent write first: a morning brief, a weekly recap, a reminder." },
        { title: "Watch what each one uses", text: "Usage shows the credits of every agent, by day or by hour." },
      ],
      more: { href: "/api", label: "Read the API docs" },
    },
  ],
}

export type Chapter = (typeof HOW_TO.chapters)[number]

export const QUESTIONS = {
  eyebrow: "Questions",
  title: "Questions people ask first.",
  items: [
    { question: "What is free, and what do I pay for?", answer: "The free plan gives you 25 credits every month. Credits pay for the models and tools your agents use. Paid plans have more credits, and you can top up." },
    { question: "Do I need to write code?", answer: "No. You build an agent in the app, in plain words. Developers can do the same over the API." },
    { question: "Where do people talk to an agent?", answer: "In the chat apps they already use: WhatsApp, Telegram, Slack and iMessage. Or on the web. Nobody downloads a new app." },
    { question: "Is every agent separate?", answer: "Yes. Each agent has its own rules, skills, apps, vault and memory. Everyone who talks to one agent shares that agent's memory, so give each person an agent of their own when they need privacy." },
    { question: "Can I sell the agents I make?", answer: "Yes. Today you charge your clients yourself. Persona does not take payments from them for you." },
    { question: "Which models can an agent use?", answer: "Models from Anthropic, OpenAI, Google and others. Give an agent up to five models and say when to use each." },
  ],
}

export const CTA = {
  title: "What will your first agent",
  last: "do?",
  text: "Answer customers, plan the family's week, or coach a whole club. It starts with one sentence.",
  button: "Start building",
  free: "No card needed. Free to start.",
}

// The footer: the about block, three link columns, then the legal row
export const FOOTER = {
  tagline: "The agent factory.",
  about: "Create AI agents for your business, for your family, or as a business of your own. Each agent is its own instance.",
  columns: [
    {
      title: "Product",
      links: [
        { href: `${DOCS}/personas`, label: "Agents" },
        { href: `${DOCS}/personas#skills`, label: "Skills" },
        { href: `${DOCS}/personas#automations`, label: "Automations" },
        { href: `${DOCS}/personas#apps`, label: "Integrations" },
        { href: `${DOCS}/channels`, label: "Channels" },
      ],
    },
    {
      title: "Developers",
      links: [
        { href: DOCS, label: "Docs" },
        { href: `${DOCS}/quickstart`, label: "Quickstart" },
        { href: `${DOCS}/api`, label: "API" },
        { href: GITHUB, label: "Source code" },
      ],
    },
    {
      title: "Company",
      links: [
        { href: APP, label: "Sign in" },
        { href: "/terms", label: "Terms" },
        { href: "/privacy", label: "Privacy" },
      ],
    },
  ],
}
