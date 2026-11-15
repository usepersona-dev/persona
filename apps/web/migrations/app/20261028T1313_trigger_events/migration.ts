#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/f0d8ec2a77ba25c7aaa95fdcbd45c85ccdf709552a63f6e3532e9974475f86d0/contract';
import endContract from '../../snapshots/f0d8ec2a77ba25c7aaa95fdcbd45c85ccdf709552a63f6e3532e9974475f86d0/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/5292e3a6620eb506bdf7068caacbd68bdae3c9eeb9c89910c17ffad822cd3c98/contract';
import startContract from '../../snapshots/5292e3a6620eb506bdf7068caacbd68bdae3c9eeb9c89910c17ffad822cd3c98/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'trigger_events',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('data', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('run_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('trigger_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trigger_events',
        index: 'trigger_events_run_id_idx_61d39f90',
        columns: ['run_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trigger_events',
        index: 'trigger_events_trigger_id_idx_9b550a5d',
        columns: ['trigger_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'trigger_events',
        foreignKey: {
          name: 'trigger_events_trigger_id_fkey',
          columns: ['trigger_id'],
          references: { schema: 'public', table: 'triggers', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'trigger_events',
        foreignKey: {
          name: 'trigger_events_run_id_fkey',
          columns: ['run_id'],
          references: { schema: 'public', table: 'runs', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
