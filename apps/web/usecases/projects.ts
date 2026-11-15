import { z } from "zod"

import { err, ok, validate, withoutUndefined } from "@/lib/errors"
import { deleteWebhook } from "@/lib/telegram"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { DEFAULT_BUNDLE, removePersona } from "@/usecases/personas"
import { readSecrets, removeSecrets } from "@/usecases/secrets"

const name = z.string().trim().min(1, "Give the project a name.").max(80, "Keep the name under 80 characters.")
const description = z.string().trim().max(500, "Keep the description under 500 characters.")
const imageUrl = z.url("That picture link is not valid.")
const createInput = z.object({ name, description: description.optional(), imageUrl: imageUrl.optional() })
const updateInput = z.object({ name: name.optional(), description: description.nullable().optional(), imageUrl: imageUrl.nullable().optional() })

export async function listProjects(caller: Caller) {
  const projects = await db.orm.public.Project.where({ orgId: caller.orgId }).orderBy((project) => project.createdAt.asc()).all()
  return ok(projects)
}

export async function getProject(caller: Caller, projectId: string) {
  const project = await db.orm.public.Project.where({ id: projectId, orgId: caller.orgId }).first()
  if (!project) return err("not_found", "This project does not exist.")

  return ok(project)
}

export async function createProject(caller: Caller, input: z.input<typeof createInput>) {
  const parsed = validate(createInput, input)
  if (!parsed.ok) return parsed
  const { name, description, imageUrl } = parsed.value

  const result = await db.transaction(async (tx) => {
    const project = await tx.orm.public.Project.create({ orgId: caller.orgId, userId: caller.userId, name, description: description || null, imageUrl: imageUrl ?? null })
    const persona = await tx.orm.public.Persona.create({ projectId: project.id, orgId: caller.orgId, name, models: DEFAULT_BUNDLE })
    return { project, persona }
  })
  return ok(result)
}

export async function updateProject(caller: Caller, projectId: string, input: z.input<typeof updateInput>) {
  const parsed = validate(updateInput, input)
  if (!parsed.ok) return parsed
  const { name, description, imageUrl } = parsed.value
  const changes = withoutUndefined({ name, description: description === "" ? null : description, imageUrl })

  const project = await getProject(caller, projectId)
  if (!project.ok) return project
  if (Object.keys(changes).length === 0) return project

  const updated = await db.orm.public.Project.where({ id: projectId }).update(changes)
  if (!updated) return err("not_found", "This project does not exist.")

  return ok(updated)
}

export async function removeProject(caller: Caller, projectId: string) {
  const project = await getProject(caller, projectId)
  if (!project.ok) return project

  const personas = await db.orm.public.Persona.where({ projectId }).select("id").all()
  for (const persona of personas) {
    const removed = await removePersona(caller, persona.id)
    if (!removed.ok) return removed
  }

  const telegramBots = await db.orm.public.TelegramBot.where({ projectId }).all()
  const botIds = telegramBots.map((bot) => bot.id)
  const botSecrets = await readSecrets(botIds)
  const botTokens = [...botSecrets.values()].flat().filter((value) => value.name === "token").map((value) => value.value)

  await Promise.allSettled(botTokens.map((token) => deleteWebhook(token)))

  await db.transaction(async (tx) => {
    if (telegramBots.length) await tx.orm.public.Link.where({ channel: "telegram" }).where((link) => link.line.in(telegramBots.map((bot) => bot.botId))).deleteAll()
    await tx.orm.public.Project.where({ id: projectId }).delete()
  })
  await removeSecrets(botIds)
  return ok(undefined)
}
