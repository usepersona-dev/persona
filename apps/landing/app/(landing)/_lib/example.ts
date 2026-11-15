// The example the app window and the ten parts show: Maya's bakery and its five agents. All of it is example data.

import type { AppId } from "./content"

export const PROJECT = "Maple Street Bakery"
export const OWNER = "Maya"

// The agents on the canvas, at their spots in percent of the canvas
export const AGENTS = [
  { name: "Front Desk", x: 31, y: 30 },
  { name: "Bookkeeper", x: 70, y: 21 },
  { name: "Scheduler", x: 19, y: 69 },
  { name: "Supplier Desk", x: 57, y: 63 },
  { name: "Scout", x: 85, y: 82 },
]

export const PANEL_TABS = ["Chat", "Instructions", "Skills", "Automations", "Integrations"]

export const CHAT = [
  { from: "me", text: "How did we do yesterday?" },
  { from: "it", text: "42 orders, most of them sourdough. 3 messages still wait for your answer." },
  { from: "me", text: "Send me this every morning at 7." },
  { from: "it", text: "Done. You get it every day at 7:00." },
] as const

export const PHONE_CHAT = [
  { from: "it", text: "Good morning, Maya. Yesterday: 42 orders. 3 messages wait for you." },
  { from: "me", text: "Read me the first." },
  { from: "it", text: "Dana asks for a nut-free birthday cake for Friday. Shall I say yes and add it to Friday's list?" },
  { from: "me", text: "Yes" },
] as const

export const RULES = [
  { name: "Tone", text: "Warm and short. Two sentences at most.", on: true },
  { name: "Allergy questions", text: "Never guess. Send them to Maya.", on: true },
  { name: "Orders", text: "Always confirm the pickup day and time.", on: true },
  { name: "Holiday hours", text: "Closed on 25 December.", on: false },
]

export const SKILLS = [
  { name: "take-an-order", text: "Collect the items, the pickup time and a name", from: "Yours" },
  { name: "invoice-reader", text: "Read a supplier invoice from a photo or a PDF", from: "skills.sh" },
  { name: "weekly-report", text: "Sum the week's sales and write Monday's report", from: "Yours" },
  { name: "humanizer", text: "Make replies sound like a person", from: "skills.sh" },
]

export const APPS: { app: AppId; name: string; text: string; connected: boolean }[] = [
  { app: "gmail", name: "Gmail", text: "Read, draft and send", connected: true },
  { app: "googlecalendar", name: "Google Calendar", text: "Read and add events", connected: true },
  { app: "googlesheets", name: "Google Sheets", text: "Read and fill rows", connected: true },
  { app: "slack", name: "Slack", text: "Read and post messages", connected: false },
  { app: "notion", name: "Notion", text: "Pages and databases", connected: false },
]

export const AUTOMATIONS = [
  { name: "Morning orders", text: "Every day at 07:00 · Last run today", on: true },
  { name: "Supplier check", text: "Mondays at 09:00 · Last run 9 Nov", on: true },
  { name: "Weekly report", text: "Fridays at 17:00 · Last run 6 Nov", on: true },
  { name: "Unpaid invoices", text: "1st of the month at 10:00", on: false },
]

export const USAGE = {
  total: "182.4 credits",
  rows: [
    { name: "Front Desk", credits: "96.1" },
    { name: "Bookkeeper", credits: "41.3" },
    { name: "Scheduler", credits: "22.8" },
    { name: "Supplier Desk", credits: "14.9" },
    { name: "Scout", credits: "7.3" },
  ],
}

export const MODELS = [
  { id: "openai/gpt-6.1-terra", when: "When: every chat" },
  { id: "openai/gpt-6-luna", when: "When: tasks that run on a schedule" },
  { id: "anthropic/claude-sonnet-5.5", when: "When: long documents and contracts" },
]

export const MEMORY = [
  { text: "Dana is allergic to nuts.", when: "Saved 3 Nov" },
  { text: "Omar takes two sourdough loaves every Friday.", when: "Saved 30 Oct" },
]

export const NOTES = [
  { text: "Friday list", when: "Edited today" },
  { text: "Supplier prices, November", when: "Edited 2 Nov" },
]
