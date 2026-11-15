#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/c92f567a24779af874f0abe3ea6fd13feb19dce8c6dec333c947d0f07f3442ef/contract';
import startContract from '../../snapshots/c92f567a24779af874f0abe3ea6fd13feb19dce8c6dec333c947d0f07f3442ef/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/93d43eb7ab3e2e6a66a65380f7b5fda83fecc78a80fa8e0f7b734da6c0af7de3/contract';
import endContract from '../../snapshots/93d43eb7ab3e2e6a66a65380f7b5fda83fecc78a80fa8e0f7b734da6c0af7de3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

// The rows the old deployment wrote through "token_usage" after the last migration have only the old token columns; this copies them into "tokens" before the columns go
const COPY_TOKENS = `UPDATE "public"."usage" SET "tokens" = jsonb_build_object('model', "model", 'provider', "provider", 'inputTokens', "input_tokens", 'cachedInputTokens', "cached_input_tokens", 'cacheWriteTokens', "cache_write_tokens", 'outputTokens', "output_tokens", 'reasoningTokens', "reasoning_tokens") WHERE "tokens" IS NULL AND "model" IS NOT NULL`;
const ALL_COPIED = `SELECT NOT EXISTS (SELECT 1 FROM "public"."usage" WHERE "tokens" IS NULL AND "model" IS NOT NULL) AS "result"`;

// The view the old deployment wrote through; it reads the old columns, so it goes before them
const DROP_OLD_NAME_VIEW = `DROP VIEW IF EXISTS "public"."token_usage"`;
const OLD_NAME_VIEW_GONE = `SELECT NOT EXISTS (SELECT 1 FROM "pg_views" WHERE "schemaname" = 'public' AND "viewname" = 'token_usage') AS "result"`;

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      rawSql({
        id: 'data.public.usage.tokens',
        label: 'Copy the token columns of the last rows into "tokens" on "usage"',
        operationClass: 'data',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'column', name: 'tokens', table: 'usage' } },
        precheck: [],
        execute: [{ description: 'copy the token columns into "tokens"', sql: COPY_TOKENS }],
        postcheck: [{ description: 'verify every row with a model has "tokens"', sql: ALL_COPIED }],
      }),
      rawSql({
        id: 'view.public.token_usage.drop',
        label: 'Drop the view "token_usage"',
        operationClass: 'destructive',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'table', name: 'token_usage' } },
        precheck: [],
        execute: [{ description: 'drop the view "token_usage"', sql: DROP_OLD_NAME_VIEW }],
        postcheck: [{ description: 'verify the view "token_usage" is gone', sql: OLD_NAME_VIEW_GONE }],
      }),
      this.dropColumn({ schema: 'public', table: 'usage', column: 'cache_write_tokens' }),
      this.dropColumn({ schema: 'public', table: 'usage', column: 'cached_input_tokens' }),
      this.dropColumn({ schema: 'public', table: 'usage', column: 'charged_usd' }),
      this.dropColumn({ schema: 'public', table: 'usage', column: 'input_tokens' }),
      this.dropColumn({ schema: 'public', table: 'usage', column: 'model' }),
      this.dropColumn({ schema: 'public', table: 'usage', column: 'output_tokens' }),
      this.dropColumn({ schema: 'public', table: 'usage', column: 'provider' }),
      this.dropColumn({ schema: 'public', table: 'usage', column: 'reasoning_tokens' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
