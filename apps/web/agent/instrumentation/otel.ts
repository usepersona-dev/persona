import { otel } from "eve/instrumentation/otel"

// Records prompts and outputs in every new session
export default otel({ tracePolicy: () => ({ emit: true, recordInputs: true, recordOutputs: true }) })
