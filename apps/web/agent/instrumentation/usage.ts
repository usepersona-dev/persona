import { defineInstrumentation } from "eve/instrumentation"
import { z } from "zod"

import { db } from "@/prisma/db"
import { chargeModelCall } from "@/usecases/credits"

const GATEWAY = z.object({ gateway: z.object({ generationId: z.string(), marketCost: z.coerce.number(), gatewayCost: z.coerce.number().nullish(), routing: z.object({ originalModelId: z.string(), finalProvider: z.string().nullish() }) }) })

// Saves each of eve's model calls as usage at the gateway's list price, under its generation id. The session row names the persona; the root session is the one a subagent's calls belong to. The settled call names no model, so the gateway's routing names the one asked for
export default defineInstrumentation({
  // The gateway's price travels with the call's output, so outputs are recorded; the content itself is not kept
  tracePolicy: () => ({ emit: true, recordInputs: false, recordOutputs: true }),
  events: {
    async "model.call.settled"(event) {
      if (event.outcome !== "completed") return

      const session = await db.orm.public.Session.where({ id: event.scope.rootSessionId }).select("personaId").first()
      if (!session) return

      const reported = GATEWAY.safeParse(event.providerMetadata)
      if (!reported.success) return console.warn("Token usage was not saved: the gateway sent no price.", event.idempotencyKey)

      const { generationId, marketCost, gatewayCost, routing } = reported.data.gateway
      const charged = await chargeModelCall(session.personaId, { id: generationId, model: routing.originalModelId, provider: routing.finalProvider, marketCost, gatewayCost }, event.usage)
      if (!charged.ok) console.warn("Token usage was not saved.", event.idempotencyKey, charged.error.message)
    }
  }
})
