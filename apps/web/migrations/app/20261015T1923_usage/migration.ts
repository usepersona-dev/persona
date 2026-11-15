#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/11bee1ae7a4a545827b81a355d262827bbb71a44a59ee14d5230ba58257e1661/contract';
import endContract from '../../snapshots/11bee1ae7a4a545827b81a355d262827bbb71a44a59ee14d5230ba58257e1661/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e401e724be19bc7faf18378ae93ec7a8f70d37ac15f6a293c805a93712b66e88/contract';
import startContract from '../../snapshots/e401e724be19bc7faf18378ae93ec7a8f70d37ac15f6a293c805a93712b66e88/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'usage',
        columns: [
          col('data', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('day', 'date', { notNull: true, codecRef: { codecId: 'pg/date-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('org_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('persona_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('project_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'usage',
        index: 'usage_org_id_day_idx_95b6d04a',
        columns: ['org_id', 'day'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'usage',
        index: 'usage_persona_id_day_idx_d6997406',
        columns: ['persona_id', 'day'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'usage',
        index: 'usage_project_id_day_idx_6253f8c3',
        columns: ['project_id', 'day'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
