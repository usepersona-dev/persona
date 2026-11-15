import { z } from "zod"

import { listModels as listGatewayModels } from "@/lib/ai-gateway"
import { deleteAccounts, deleteSession, deleteTrigger } from "@/lib/composio"
import { err, ok, validate, withoutUndefined } from "@/lib/errors"
import { s3Files } from "@/lib/s3"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { removeSecrets } from "@/usecases/secrets"

export const ROUTER_MODEL = "typesafe-ai/jev-1.14.0"
export const ROUTER_LIMIT = 16_000
export const ROUTER_MESSAGES = 8
export const ROUTER_INSTRUCTIONS = "Select the model best suited to the user's task using the option descriptions."
export const DEFAULT_MODEL = "openai/gpt-6.1-terra"
export const DEFAULT_BUNDLE = [
  { model: "openai/gpt-6.1-terra", when: "Every chat with the person, including when an automation's report (\"just ran … this isn't a message from the person\") is passed into the chat. Also every task handed to a subagent: its first message starts with 'You are the subagent'." },
  { model: "openai/gpt-6-luna", when: "Only a run itself: the newest message is the run's own task, like 'Your automation … is due now. Do the task below', with nobody to talk with. Never a chat with the person, even when the chat shows an automation's report. Never a subagent's task ('You are the subagent …')." },
]

export const CONTEXT_WINDOW = 200_000
export const CAPABILITIES = ["tool-use"]

const name = z.string().trim().min(1, "Give the persona a name.").max(80, "Keep the name under 80 characters.")
const imageUrl = z.url("That picture link is not valid.")
const createInput = z.object({ projectId: z.string(), name, imageUrl: imageUrl.optional() })
const modelOption = z.object({ model: z.string().trim().min(1), when: z.string().trim().min(1, "Say when to use each model.").max(500, "Keep each when under 500 characters.") })
const modelBundle = z.array(modelOption).max(5, "Pick up to 5 models.").refine((list) => new Set(list.map((item) => item.model)).size === list.length, "Pick each model once.").refine((list) => list.length < 2 || list.every((item) => item.when !== ""), "Say when to use each model.")
const updateInput = z.object({ name: name.optional(), imageUrl: imageUrl.nullable().optional(), models: modelBundle.nullable().optional() })
const duplicateInput = z.object({ name: name.optional() })

export async function listPersonas(caller: Caller, projectId: string) {
  const project = await findProject(caller, projectId)
  if (!project.ok) return project

  const personas = await db.orm.public.Persona.where({ projectId, orgId: caller.orgId }).orderBy((persona) => persona.createdAt.asc()).all()
  return ok(personas)
}

export async function getPersona(caller: Caller, personaId: string) {
  if (caller.personaId && caller.personaId !== personaId) return err("not_found", "This persona does not exist.")

  const persona = await db.orm.public.Persona.where({ id: personaId, orgId: caller.orgId }).first()
  if (!persona) return err("not_found", "This persona does not exist.")

  return ok(persona)
}

export async function createPersona(caller: Caller, input: z.input<typeof createInput>) {
  const parsed = validate(createInput, input)
  if (!parsed.ok) return parsed
  const { projectId, name, imageUrl } = parsed.value

  const project = await findProject(caller, projectId)
  if (!project.ok) return project

  const persona = await db.orm.public.Persona.create({ projectId, orgId: caller.orgId, name, imageUrl: imageUrl ?? null, models: DEFAULT_BUNDLE })
  return ok(persona)
}

export async function updatePersona(caller: Caller, personaId: string, input: z.input<typeof updateInput>) {
  const parsed = validate(updateInput, input)
  if (!parsed.ok) return parsed
  // Restore sends null for the models, which brings back the default bundle
  const models = parsed.value.models === null ? DEFAULT_BUNDLE : parsed.value.models
  const changes = withoutUndefined({ ...parsed.value, models })

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona
  if (Object.keys(changes).length === 0) return persona

  const updated = await db.orm.public.Persona.where({ id: personaId }).update(changes)
  if (!updated) return err("not_found", "This persona does not exist.")

  return ok(updated)
}

export async function removePersona(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const setup = await readSetup(personaId)
  const secretOwners = [...setup.connections, ...setup.credentials].map((row) => row.id)

  await s3Files.removeFolder(`${personaId}/`)
  const triggers = await db.orm.public.Trigger.where({ personaId }).all()
  for (const trigger of triggers) await deleteTrigger(trigger.id).catch(() => undefined)
  await deleteAccounts(personaId).catch(() => 0)
  if (persona.value.composioSessionId) await deleteSession(persona.value.composioSessionId).catch(() => undefined)

  await db.orm.public.Persona.where({ id: personaId }).delete()
  await removeSecrets(secretOwners)
  return ok(undefined)
}

// A copy gets the name, picture and models, the instructions, the skills, the vault fields without their values, and the automations, paused. Files, connections, chats, links and app sign-ins stay with the original.
export async function duplicatePersona(caller: Caller, personaId: string, input: z.input<typeof duplicateInput> = {}) {
  const parsed = validate(duplicateInput, input)
  if (!parsed.ok) return parsed
  const { name } = parsed.value

  const source = await getPersona(caller, personaId)
  if (!source.ok) return source

  const setup = await readSetup(personaId)
  const personaRow = { projectId: source.value.projectId, orgId: caller.orgId, name: name ?? `${source.value.name} (copy)`, imageUrl: source.value.imageUrl, models: source.value.models }

  const persona = await db.transaction(async (tx) => {
    const created = await tx.orm.public.Persona.create(personaRow)
    const instructionRows = setup.instructions.map((instruction) => ({ personaId: created.id, name: instruction.name, content: instruction.content, enabled: instruction.enabled }))
    const skillRows = setup.skills.map((skill) => ({ personaId: created.id, name: skill.name, description: skill.description, markdown: skill.markdown, files: skill.files, enabled: skill.enabled, origin: skill.origin }))
    const credentialRows = setup.credentials.map((credential) => ({ personaId: created.id, title: credential.title, description: credential.description, fields: credential.fields }))
    const scheduleRows = setup.schedules.map((schedule) => ({ personaId: created.id, name: schedule.name, prompt: schedule.prompt, cron: schedule.cron, at: schedule.at, timezone: schedule.timezone, enabled: false }))

    if (instructionRows.length) await tx.orm.public.Instruction.createAll(instructionRows)
    if (skillRows.length) await tx.orm.public.Skill.createAll(skillRows)
    if (credentialRows.length) await tx.orm.public.Credential.createAll(credentialRows)
    if (scheduleRows.length) await tx.orm.public.Schedule.createAll(scheduleRows)
    return created
  })
  return ok(persona)
}

// The models a persona can run on: eve needs tool use and the full context window
export async function listModels() {
  const catalogue = await listGatewayModels()
  const models = catalogue
    .filter((model) => CAPABILITIES.every((tag) => model.tags.includes(tag)))
    .filter((model) => (model.context ?? 0) >= CONTEXT_WINDOW)
    .map((model) => ({ ...model, default: model.id === DEFAULT_MODEL }))
  return ok(models)
}

async function findProject(caller: Caller, projectId: string) {
  const project = await db.orm.public.Project.where({ id: projectId, orgId: caller.orgId }).first()
  if (!project) return err("not_found", "This project does not exist.")

  return ok(project)
}

async function readSetup(personaId: string) {
  const instructions = await db.orm.public.Instruction.where({ personaId }).orderBy((row) => row.createdAt.asc()).all()
  const skills = await db.orm.public.Skill.where({ personaId }).orderBy((row) => row.createdAt.asc()).all()
  const connections = await db.orm.public.Connection.where({ personaId }).orderBy((row) => row.createdAt.asc()).all()
  const credentials = await db.orm.public.Credential.where({ personaId }).orderBy((row) => row.createdAt.asc()).all()
  const schedules = await db.orm.public.Schedule.where({ personaId }).orderBy((row) => row.createdAt.asc()).all()
  return { instructions, skills, connections, credentials, schedules }
}
