#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/11bee1ae7a4a545827b81a355d262827bbb71a44a59ee14d5230ba58257e1661/contract';
import startContract from '../../snapshots/11bee1ae7a4a545827b81a355d262827bbb71a44a59ee14d5230ba58257e1661/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a8a5a68d6e531105ababfd4e280b0cc62af9d8132ccfce9660ab1358d4b4d050/contract';
import endContract from '../../snapshots/a8a5a68d6e531105ababfd4e280b0cc62af9d8132ccfce9660ab1358d4b4d050/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  lit,
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
        table: 'messages',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('files', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('session_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('turn_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'messages_role_check_bc5dc231',
            sql`"role" IN ('user', 'assistant', 'system')`,
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'sessions',
        column: col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sessions',
        column: col('channel', 'text', {
          notNull: true,
          default: lit('unknown'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sessions',
        column: col('ended_at', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sessions',
        column: col('last_turn_at', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sessions',
        column: col('status', 'text', {
          notNull: true,
          default: lit('running'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sessions',
        column: col('user_id', 'text', {
          notNull: true,
          default: lit('unknown'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'sessions',
        constraint: 'sessions_status_check_51d0fd1b',
        expression: sql`"status" IN ('running', 'waiting', 'ended', 'failed')`,
      }),
      this.createIndex({
        schema: 'public',
        table: 'messages',
        index: 'messages_session_id_created_at_idx_d635b073',
        columns: ['session_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'messages',
        index: 'messages_session_id_idx_00ba47bf',
        columns: ['session_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sessions',
        index: 'sessions_address_idx_2629f7e3',
        columns: ['address'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'messages',
        foreignKey: {
          name: 'messages_session_id_fkey',
          columns: ['session_id'],
          references: { schema: 'public', table: 'sessions', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
