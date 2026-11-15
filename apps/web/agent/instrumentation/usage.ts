import { defineInstrumentation } from "eve/instrumentation"

import { db } from "@/prisma/db"
import { chargeGatewayCall } from "@/usecases/credits"

// Saves each of eve's model calls as usage. The session row names the persona; the root session is the one a subagent's calls belong to
export default defineInstrumentation({
  // The gateway's price travels with the call's output, so outputs are recorded; the content itself is not kept
  tracePolicy: () => ({ emit: true, recordInputs: false, recordOutputs: true }),
  events: {
    async "model.call.settled"(event) {
      if (event.outcome !== "completed") return

      const session = await db.orm.public.Session.where({ id: event.scope.rootSessionId }).select("personaId").first()
      if (!session) return

      const charged = await chargeGatewayCall(session.personaId, event.scope.sessionId, event)
      if (!charged.ok) console.warn("Token usage was not saved.", event.idempotencyKey, charged.error.message)
    }
  }
})
