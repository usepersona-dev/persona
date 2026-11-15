#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/688beea1dc4a552383b68c2c27d682502e01ac4eb7c103d55ac0fc5e9c940bb2/contract';
import startContract from '../../snapshots/688beea1dc4a552383b68c2c27d682502e01ac4eb7c103d55ac0fc5e9c940bb2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/6bd3ca1d1b00235f59c4840c193cb901401f235e4df212f7c719714d538e8dd3/contract';
import endContract from '../../snapshots/6bd3ca1d1b00235f59c4840c193cb901401f235e4df212f7c719714d538e8dd3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'token_usage',
        columns: [
          col('at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('cache_write_tokens', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('cached_input_tokens', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('charged_usd', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('credits', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('input_tokens', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('model', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('org_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('output_tokens', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('persona_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('project_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('provider', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reasoning_tokens', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('session_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'token_usage',
        index: 'token_usage_org_id_at_idx_ab85051d',
        columns: ['org_id', 'at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'token_usage',
        index: 'token_usage_project_id_at_idx_e662f53b',
        columns: ['project_id', 'at'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
