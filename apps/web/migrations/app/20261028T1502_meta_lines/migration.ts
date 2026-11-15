#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/f0d8ec2a77ba25c7aaa95fdcbd45c85ccdf709552a63f6e3532e9974475f86d0/contract';
import startContract from '../../snapshots/f0d8ec2a77ba25c7aaa95fdcbd45c85ccdf709552a63f6e3532e9974475f86d0/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/0b586978c67ece50457318d94bd9d29bde1137030704a6b22325f483fc6d85fd/contract';
import endContract from '../../snapshots/0b586978c67ece50457318d94bd9d29bde1137030704a6b22325f483fc6d85fd/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'links',
        constraint: 'links_channel_check_75243d83',
      }),
      this.createTable({
        schema: 'public',
        table: 'meta_lines',
        columns: [
          col('access_token', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('app_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('app_secret', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('number', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('phone_number_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('pin', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('project_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('verify_token', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('waba_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'links',
        constraint: 'links_channel_check_09e64f4c',
        expression: sql`"channel" IN ('whatsapp', 'whatsapp_v2', 'whatsapp_meta', 'telegram')`,
      }),
      this.addUnique({
        schema: 'public',
        table: 'meta_lines',
        constraint: 'meta_lines_phone_number_id_key',
        columns: ['phone_number_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'meta_lines',
        index: 'meta_lines_project_id_idx_6ad92603',
        columns: ['project_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'meta_lines',
        foreignKey: {
          name: 'meta_lines_project_id_fkey',
          columns: ['project_id'],
          references: { schema: 'public', table: 'projects', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
