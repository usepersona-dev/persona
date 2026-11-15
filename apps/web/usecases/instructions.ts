import { z } from "zod"

import { err, ok, validate, withoutUndefined } from "@/lib/errors"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"

const name = z.string().trim().min(1, "Give the instruction a name.").max(80, "Keep the name under 80 characters.")
const content = z.string().trim().min(1, "Write the instruction.").max(50_000, "Keep the instruction under 50,000 characters.")
const addInput = z.object({ name, content, enabled: z.boolean().optional() })
const updateInput = z.object({ name: name.optional(), content: content.optional(), enabled: z.boolean().optional() })

export async function listInstructions(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const instructions = await db.orm.public.Instruction.where({ personaId }).orderBy((instruction) => instruction.createdAt.asc()).all()
  return ok(instructions)
}

export async function addInstruction(caller: Caller, personaId: string, input: z.input<typeof addInput>) {
  const parsed = validate(addInput, input)
  if (!parsed.ok) return parsed
  const { name, content, enabled } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const taken = await db.orm.public.Instruction.where({ personaId, name }).first()
  if (taken) return err("conflict", `This persona already has an instruction named "${name}".`)

  const instruction = await db.orm.public.Instruction.create({ personaId, name, content, enabled: enabled ?? true })
  return ok(instruction)
}

export async function updateInstruction(caller: Caller, instructionId: string, input: z.input<typeof updateInput>) {
  const parsed = validate(updateInput, input)
  if (!parsed.ok) return parsed
  const changes = withoutUndefined(parsed.value)

  const instruction = await findInstruction(caller, instructionId)
  if (!instruction.ok) return instruction

  if (changes.name && changes.name !== instruction.value.name) {
    const taken = await db.orm.public.Instruction.where({ personaId: instruction.value.personaId, name: changes.name }).first()
    if (taken) return err("conflict", `This persona already has an instruction named "${changes.name}".`)
  }
  if (Object.keys(changes).length === 0) return instruction

  const updated = await db.orm.public.Instruction.where({ id: instructionId }).update(changes)
  if (!updated) return err("not_found", "This instruction does not exist.")

  return ok(updated)
}

export async function removeInstruction(caller: Caller, instructionId: string) {
  const instruction = await findInstruction(caller, instructionId)
  if (!instruction.ok) return instruction

  await db.orm.public.Instruction.where({ id: instructionId }).delete()
  return ok(undefined)
}

async function findInstruction(caller: Caller, instructionId: string) {
  const instruction = await db.orm.public.Instruction.where({ id: instructionId }).first()
  if (!instruction) return err("not_found", "This instruction does not exist.")

  const persona = await getPersona(caller, instruction.personaId)
  if (!persona.ok) return err("not_found", "This instruction does not exist.")

  return ok(instruction)
}
