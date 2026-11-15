#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/93d43eb7ab3e2e6a66a65380f7b5fda83fecc78a80fa8e0f7b734da6c0af7de3/contract';
import startContract from '../../snapshots/93d43eb7ab3e2e6a66a65380f7b5fda83fecc78a80fa8e0f7b734da6c0af7de3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e90027151ec2f806c522220bf1d8afb4927eeeb72364b508587151fc089d0e5f/contract';
import endContract from '../../snapshots/e90027151ec2f806c522220bf1d8afb4927eeeb72364b508587151fc089d0e5f/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'credit_grants',
        columns: [
          col('at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('credits', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('org_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('credit_grants_kind_check_0b7f914e', sql`"kind" IN ('gift', 'topUp')`),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'organizations',
        column: col('plan', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'credit_grants',
        index: 'credit_grants_org_id_at_idx_ab85051d',
        columns: ['org_id', 'at'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
