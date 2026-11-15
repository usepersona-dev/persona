import { z } from "zod"

import { err, ok, validate, withoutUndefined } from "@/lib/errors"
import { skillsSh } from "@/lib/skills-sh"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"

const RESERVED_NAMES = ["eve"]

const name = z.string().trim().min(1, "Give the skill a name.").max(64, "Keep the name under 64 characters.").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes for the skill name.").refine((value) => !RESERVED_NAMES.includes(value), "Persona uses this name. Pick another.")
const description = z.string().trim().min(1, "Describe when the skill should be used.").max(1024, "Keep the description under 1024 characters.")
const markdown = z.string().max(200_000, "Keep the skill under 200,000 characters.")
const file = z.object({ path: z.string().min(1).max(300).refine(isSafePath, "Use relative paths inside the skill, and keep SKILL.md out of the files."), contents: z.string().max(1_000_000, "Keep each file under 1,000,000 characters.") })
const files = z.array(file).max(500, "A skill can have up to 500 files.")
const addInput = z.object({ name, description, markdown, files: files.optional(), enabled: z.boolean().optional() })
const updateInput = z.object({ name: name.optional(), description: description.optional(), markdown: markdown.optional(), files: files.optional(), enabled: z.boolean().optional() })
const marketplaceInput = z.object({ name, description })
const skillsInput = z.object({ enabled: z.boolean().optional() })
const marketplaceSkillId = z.string("Pick a skill from skills.sh.").trim().regex(/^[A-Za-z0-9_-][A-Za-z0-9_.-]*(\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)+$/, "Pick a skill from skills.sh.")
const summary = ["id", "personaId", "name", "description", "enabled", "origin", "createdAt", "updatedAt"] as const

export async function listSkills(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const skills = await db.orm.public.Skill.where({ personaId }).select(...summary).orderBy((skill) => skill.createdAt.asc()).all()
  return ok(skills)
}

export async function getSkill(caller: Caller, skillId: string) {
  const skill = await findSkill(caller, skillId)
  return skill
}

export async function getSkills(caller: Caller, personaId: string, input: z.input<typeof skillsInput> = {}) {
  const parsed = validate(skillsInput, input)
  if (!parsed.ok) return parsed
  const filter = withoutUndefined(parsed.value)

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const skills = await db.orm.public.Skill.where({ personaId, ...filter }).orderBy((skill) => skill.createdAt.asc()).all()
  return ok(skills)
}

// Where a skill came from: written in the app (custom), saved by the persona (agent), or installed from skills.sh (hub, with its skills.sh id). Only an install makes a hub skill.
export type SkillOrigin = { kind: "custom" | "agent" | "hub"; id: string | null }

export async function addSkill(caller: Caller, personaId: string, input: z.input<typeof addInput>, kind: "custom" | "agent" = "custom") {
  const parsed = validate(addInput, input)
  if (!parsed.ok) return parsed
  const { name, description, markdown, files, enabled } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const taken = await db.orm.public.Skill.where({ personaId, name }).first()
  if (taken) return err("conflict", `This persona already has a skill named "${name}".`)

  const origin: SkillOrigin = { kind, id: null }
  const skill = await db.orm.public.Skill.create({ personaId, name, description, markdown, files: files ?? [], enabled: enabled ?? true, origin })
  return ok(skill)
}

export async function updateSkill(caller: Caller, skillId: string, input: z.input<typeof updateInput>) {
  const parsed = validate(updateInput, input)
  if (!parsed.ok) return parsed
  const changes = withoutUndefined(parsed.value)

  const skill = await findSkill(caller, skillId)
  if (!skill.ok) return skill

  if (changes.name && changes.name !== skill.value.name) {
    const taken = await db.orm.public.Skill.where({ personaId: skill.value.personaId, name: changes.name }).first()
    if (taken) return err("conflict", `This persona already has a skill named "${changes.name}".`)
  }
  if (Object.keys(changes).length === 0) return skill

  const updated = await db.orm.public.Skill.where({ id: skillId }).update(changes)
  if (!updated) return err("not_found", "This skill does not exist.")

  return ok(updated)
}

export async function removeSkill(caller: Caller, skillId: string) {
  const skill = await findSkill(caller, skillId)
  if (!skill.ok) return skill

  await db.orm.public.Skill.where({ id: skillId }).delete()
  return ok(undefined)
}

export async function searchSkillMarketplace(query: string) {
  const skills = await skillsSh.search(query)
  return ok(skills)
}

export async function previewMarketplaceSkill(marketplaceId: string) {
  const skill = await readMarketplaceSkill(marketplaceId)
  return skill
}

export async function installMarketplaceSkill(caller: Caller, personaId: string, marketplaceId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const marketplaceSkill = await readMarketplaceSkill(marketplaceId)
  if (!marketplaceSkill.ok) return marketplaceSkill

  const taken = await db.orm.public.Skill.where({ personaId, name: marketplaceSkill.value.name }).first()
  if (taken) return err("conflict", `This persona already has a skill named "${marketplaceSkill.value.name}".`)

  const skill = await db.orm.public.Skill.create({ personaId, name: marketplaceSkill.value.name, description: marketplaceSkill.value.description, markdown: marketplaceSkill.value.markdown, files: marketplaceSkill.value.files, origin: { kind: "hub", id: marketplaceSkill.value.marketplaceId } })
  return ok(skill)
}

async function findSkill(caller: Caller, skillId: string) {
  const skill = await db.orm.public.Skill.where({ id: skillId }).first()
  if (!skill) return err("not_found", "This skill does not exist.")

  const persona = await getPersona(caller, skill.personaId)
  if (!persona.ok) return err("not_found", "This skill does not exist.")

  return ok(skill)
}

async function readMarketplaceSkill(marketplaceId: string) {
  const id = validate(marketplaceSkillId, marketplaceId)
  if (!id.ok) return id

  const found = await fetchMarketplaceSkill(id.value)
  if (!found.ok) return found

  const allFiles = found.value.files ?? []
  const skillFile = allFiles.find((entry) => entry.path === "SKILL.md")
  if (!skillFile) return err("not_found", "skills.sh has no SKILL.md for this skill.")

  const { fields, body } = readFrontmatter(skillFile.contents)
  const skillName = toSkillName(fields.name || found.value.slug)
  const checked = validate(marketplaceInput, { name: skillName, description: fields.description ?? "" })
  if (!checked.ok) return checked

  const otherFiles = allFiles.filter((entry) => entry.path !== "SKILL.md" && isSafePath(entry.path))
  const skill = { marketplaceId: found.value.id, source: found.value.source, installs: found.value.installs, name: checked.value.name, description: checked.value.description, markdown: body.trim(), files: otherFiles }
  return ok(skill)
}

async function fetchMarketplaceSkill(marketplaceId: string) {
  try {
    const found = await skillsSh.read(marketplaceId)
    return ok(found)
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("404")) return err("not_found", "This skill is not on skills.sh.")
    throw error
  }
}

function readFrontmatter(text: string): { fields: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/.exec(text)
  if (!match) return { fields: {}, body: text }

  const fields: Record<string, string> = {}
  const lines = match[1].split(/\r?\n/)
  for (let index = 0; index < lines.length; index++) {
    const line = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(lines[index])
    if (!line) continue

    const [, key, value] = line
    const isBlock = /^[|>][+-]?$/.test(value)
    if (!isBlock) {
      fields[key] = value.trim().replace(/^(["'])([\s\S]*)\1$/, "$2")
      continue
    }

    const block: string[] = []
    while (index + 1 < lines.length && (lines[index + 1].trim() === "" || /^\s/.test(lines[index + 1]))) {
      index++
      block.push(lines[index].trim())
    }
    const joined = value.startsWith(">") ? block.join(" ") : block.join("\n")
    fields[key] = joined.trim()
  }

  return { fields, body: match[2] }
}

function toSkillName(text: string): string {
  const skillName = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64).replace(/-+$/, "")
  return skillName
}

function isSafePath(path: string): boolean {
  if (path === "SKILL.md" || path.startsWith("/")) return false

  const segments = path.split("/")
  const hasBadSegment = segments.some((segment) => segment === "" || segment === "." || segment === "..")
  return !hasBadSegment
}
