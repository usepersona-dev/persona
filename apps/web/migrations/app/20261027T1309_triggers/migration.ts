#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/682afb4506a115d56e8c732856de21bd738cdd3253b59c1c755c4765a5e56743/contract';
import startContract from '../../snapshots/682afb4506a115d56e8c732856de21bd738cdd3253b59c1c755c4765a5e56743/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b127061e0c9ff1612bc203ebb24be508ad20542c76082bad8e4a576b185e7d58/contract';
import endContract from '../../snapshots/b127061e0c9ff1612bc203ebb24be508ad20542c76082bad8e4a576b185e7d58/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'runs',
        constraint: 'runs_source_check_e052350f',
      }),
      this.createTable({
        schema: 'public',
        table: 'triggers',
        columns: [
          col('account_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('enabled', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('link_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('persona_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('prompt', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'runs',
        column: col('event_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'runs',
        column: col('trigger_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'runs',
        constraint: 'runs_source_check_4a436c3d',
        expression: sql`"source" IN ('automation', 'webhook', 'trigger')`,
      }),
      this.addUnique({
        schema: 'public',
        table: 'runs',
        constraint: 'runs_event_id_key',
        columns: ['event_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'runs',
        index: 'runs_trigger_id_idx_9b550a5d',
        columns: ['trigger_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'triggers',
        index: 'triggers_link_id_idx_fdb33a76',
        columns: ['link_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'triggers',
        index: 'triggers_persona_id_idx_840c67e2',
        columns: ['persona_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'triggers',
        foreignKey: {
          name: 'triggers_persona_id_fkey',
          columns: ['persona_id'],
          references: { schema: 'public', table: 'personas', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'triggers',
        foreignKey: {
          name: 'triggers_link_id_fkey',
          columns: ['link_id'],
          references: { schema: 'public', table: 'links', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'runs',
        foreignKey: {
          name: 'runs_trigger_id_fkey',
          columns: ['trigger_id'],
          references: { schema: 'public', table: 'triggers', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
