import { postgresSchemaStatements } from "@chat-adapter/state-pg"
import { expect, test } from "vitest"

// Our migrations own the Chat SDK's tables: the ChatState* models in prisma/contract.prisma copy them, and the channels run the SDK's adapter with autoCreateSchema: false.
// The snapshot is the SDK's own SQL for those tables. After a Chat SDK update that changes them, this fails: copy the change into the contract (prisma contract infer on the tables the new SDK makes), plan a migration, then update the snapshot with vitest -u
test("the Chat SDK's tables are still the ones our contract copies", () => {
  expect(postgresSchemaStatements).toMatchSnapshot()
})
