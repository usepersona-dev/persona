import { QueueClient } from "@vercel/queue"

export const AUTOMATION_RUNS = "automation-runs"
export const TRIGGER_RUNS = "trigger-runs"
export const REPORTS = "reports"

// Automation runs wait in this topic until their start; vercel.json hands the topic to app/api/queues/automation-runs
export type AutomationRun = { automationId: string; runId: string }

// Trigger runs go through this topic as soon as their events have waited; vercel.json hands the topic to app/api/queues/trigger-runs
export type TriggerRun = { triggerId: string; runId: string }

// Runs worth telling go through this topic as soon as they end, each with the report route of its own channel; vercel.json hands the topic to app/api/queues/reports
export type Report = { path: string }

export const queue = new QueueClient({ region: "iad1" })
