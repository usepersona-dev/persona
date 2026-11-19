#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/088bce71e784ecdd7cc3a1b0a2fe8accec4987f33204c47221c7e4ae32b4c66a/contract';
import startContract from '../../snapshots/088bce71e784ecdd7cc3a1b0a2fe8accec4987f33204c47221c7e4ae32b4c66a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/161f68312fc87aeeaa127a7351c7fbc2901868b72b0d13e556991a76268c1840/contract';
import endContract from '../../snapshots/161f68312fc87aeeaa127a7351c7fbc2901868b72b0d13e556991a76268c1840/contract.json' with { type: 'json' };
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
      this.createTable({
        schema: 'public',
        table: 'tools',
        columns: [
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
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('persona_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'tools',
        constraint: 'tools_persona_id_name_key',
        columns: ['persona_id', 'name'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'tools',
        index: 'tools_persona_id_idx_840c67e2',
        columns: ['persona_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'tools',
        foreignKey: {
          name: 'tools_persona_id_fkey',
          columns: ['persona_id'],
          references: { schema: 'public', table: 'personas', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
