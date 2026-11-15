#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/824ceff79a430cc04fa3244fb369de965adb39412111af0339ad59a61cd001d3/contract';
import endContract from '../../snapshots/824ceff79a430cc04fa3244fb369de965adb39412111af0339ad59a61cd001d3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e90027151ec2f806c522220bf1d8afb4927eeeb72364b508587151fc089d0e5f/contract';
import startContract from '../../snapshots/e90027151ec2f806c522220bf1d8afb4927eeeb72364b508587151fc089d0e5f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, rawSql } from '@prisma/orm-postgres/migration';
// Usage counted one credit per dollar of the AI Gateway's list price; a credit is now $0.20 of it, so every row is counted again in the new credits, once. That dollar price, the call's market cost, stays in its tokens
const USAGE_IN_CREDITS = `UPDATE "public"."usage" SET "tokens" = CASE WHEN "tokens" IS NULL THEN NULL ELSE "tokens" || jsonb_build_object('marketCost', "credits"::text) END, "credits" = "credits" / 0.2`;

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropTable({ schema: 'public', table: 'credit_grants' }),
      this.dropTable({ schema: 'public', table: 'usage_periods' }),
      this.addColumn({
        schema: 'public',
        table: 'organizations',
        column: col('stripe_customer_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'organizations',
        constraint: 'organizations_stripe_customer_id_key',
        columns: ['stripe_customer_id'],
      }),
      rawSql({
        id: 'data.public.usage.credits',
        label: 'Count usage in credits of $0.20',
        operationClass: 'data',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'column', name: 'credits', table: 'usage' } },
        precheck: [],
        execute: [{ description: 'count usage in credits of $0.20, keeping its market cost in its tokens', sql: USAGE_IN_CREDITS }],
        postcheck: [],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
