#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c92f567a24779af874f0abe3ea6fd13feb19dce8c6dec333c947d0f07f3442ef/contract';
import endContract from '../../snapshots/c92f567a24779af874f0abe3ea6fd13feb19dce8c6dec333c947d0f07f3442ef/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/26b72ac3685dc4a59bcbaf6f3587b48a9354e332cc8db23c8e844c329d761795/contract';
import startContract from '../../snapshots/26b72ac3685dc4a59bcbaf6f3587b48a9354e332cc8db23c8e844c329d761795/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey, rawSql, sql } from '@prisma/orm-postgres/migration';

// Copies each row's token columns into "tokens", the AI call's kind of usage, in the shape the ORM writes it. The old columns stay until a later migration drops them
const COPY_TOKENS = `UPDATE "public"."usage" SET "tokens" = jsonb_build_object('model', "model", 'provider', "provider", 'inputTokens', "input_tokens", 'cachedInputTokens', "cached_input_tokens", 'cacheWriteTokens', "cache_write_tokens", 'outputTokens', "output_tokens", 'reasoningTokens', "reasoning_tokens") WHERE "tokens" IS NULL AND "model" IS NOT NULL`;
const ALL_COPIED = `SELECT NOT EXISTS (SELECT 1 FROM "public"."usage" WHERE "tokens" IS NULL AND "model" IS NOT NULL) AS "result"`;

// The deployment still running while this one builds keeps writing "token_usage" for a minute; this view passes its writes and reads to "usage". The next migration drops it
const OLD_NAME_VIEW = `CREATE VIEW "public"."token_usage" AS SELECT * FROM "public"."usage"`;
const OLD_NAME_VIEW_EXISTS = `SELECT EXISTS (SELECT 1 FROM "pg_views" WHERE "schemaname" = 'public' AND "viewname" = 'token_usage') AS "result"`;

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      ...this.renameTable({ schema: 'public', table: 'token_usage', to: 'usage' }),
      this.dropIndex({
        schema: 'public',
        table: 'usage',
        index: 'token_usage_org_id_at_idx_ab85051d',
      }),
      this.createTable({
        schema: 'public',
        table: 'usage_periods',
        columns: [
          col('allowance', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('org_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('period_end', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('period_start', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('used', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
        ],
        constraints: [primaryKey(['org_id', 'period_start'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'usage',
        column: col('tokens', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
      }),
      this.dropNotNull({ schema: 'public', table: 'usage', column: 'cache_write_tokens' }),
      this.dropNotNull({ schema: 'public', table: 'usage', column: 'cached_input_tokens' }),
      this.dropNotNull({ schema: 'public', table: 'usage', column: 'charged_usd' }),
      this.dropNotNull({ schema: 'public', table: 'usage', column: 'input_tokens' }),
      this.dropNotNull({ schema: 'public', table: 'usage', column: 'model' }),
      this.dropNotNull({ schema: 'public', table: 'usage', column: 'output_tokens' }),
      this.dropNotNull({ schema: 'public', table: 'usage', column: 'reasoning_tokens' }),
      rawSql({
        id: 'data.public.usage.tokens',
        label: 'Copy the token columns into "tokens" on "usage"',
        operationClass: 'data',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'column', name: 'tokens', table: 'usage' } },
        precheck: [],
        execute: [{ description: 'copy the token columns into "tokens"', sql: COPY_TOKENS }],
        postcheck: [{ description: 'verify every row with a model has "tokens"', sql: ALL_COPIED }],
      }),
      this.createIndex({
        schema: 'public',
        table: 'usage',
        index: 'usage_org_id_at_credits_idx_09dd1c38',
        columns: ['org_id', 'at', 'credits'],
      }),
      rawSql({
        id: 'view.public.token_usage',
        label: 'Add the view "token_usage" over "usage" for the deployment still running',
        operationClass: 'additive',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'table', name: 'token_usage' } },
        precheck: [],
        execute: [{ description: 'create the view "token_usage"', sql: OLD_NAME_VIEW }],
        postcheck: [{ description: 'verify the view "token_usage" exists', sql: OLD_NAME_VIEW_EXISTS }],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
