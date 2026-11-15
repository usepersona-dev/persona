#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/aa9d0504f1d76e06a2988bc9d418b474a1f625d360bca9a0d4eaeaaafab9461e/contract';
import startContract from '../../snapshots/aa9d0504f1d76e06a2988bc9d418b474a1f625d360bca9a0d4eaeaaafab9461e/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e401e724be19bc7faf18378ae93ec7a8f70d37ac15f6a293c805a93712b66e88/contract';
import endContract from '../../snapshots/e401e724be19bc7faf18378ae93ec7a8f70d37ac15f6a293c805a93712b66e88/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'sessions',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('persona_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'browsers',
        column: col('closed_at', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'sessions',
        index: 'sessions_persona_id_idx_840c67e2',
        columns: ['persona_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'sessions',
        foreignKey: {
          name: 'sessions_persona_id_fkey',
          columns: ['persona_id'],
          references: { schema: 'public', table: 'personas', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
