import { otel } from "eve/instrumentation/otel"

// Records prompts and outputs in every new session. Since ai 7.0.163, a session that hides them also hides the persona and the gateway price from usage.ts
export default otel({ tracePolicy: () => ({ emit: true, recordInputs: true, recordOutputs: true }) })
