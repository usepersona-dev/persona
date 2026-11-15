#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/a26224642fc438b4f99157e48911b3167093f1f43ad7628fe9cdd3595eab6d90/contract';
import startContract from '../../snapshots/a26224642fc438b4f99157e48911b3167093f1f43ad7628fe9cdd3595eab6d90/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f7a3600a0c2d499ffc0998f3f8ee39b6a1a433c559da7a3e275a81cd6bd8a250/contract';
import endContract from '../../snapshots/f7a3600a0c2d499ffc0998f3f8ee39b6a1a433c559da7a3e275a81cd6bd8a250/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql, sql } from '@prisma/orm-postgres/migration';

// The runs of 10-29 to 10-31 saved a result with no notify, and the check below refuses those rows. notify is read only when a run ends, so false changes nothing on them
const ADD_NOTIFY = `UPDATE "public"."runs" SET "result" = "result" || '{"notify": false}'::jsonb WHERE "result" ? 'summary' AND NOT "result" ? 'notify'`;
const ALL_HAVE_NOTIFY = `SELECT NOT EXISTS (SELECT 1 FROM "public"."runs" WHERE "result" ? 'summary' AND NOT "result" ? 'notify') AS "result"`;

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      rawSql({
        id: 'data.public.runs.result',
        label: 'Add notify to the old results on "runs"',
        operationClass: 'data',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'column', name: 'result', table: 'runs' } },
        precheck: [],
        execute: [{ description: 'add notify to the results that have none', sql: ADD_NOTIFY }],
        postcheck: [{ description: 'verify every result with a summary has notify', sql: ALL_HAVE_NOTIFY }],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'credentials',
        constraint: 'credentials_fields_shape_edecd7d9',
        expression: sql`jsonb_path_match("fields", 'strict $.type() == "array" && !exists($[*] ? (!((@.type() == "object" && exists(@.keyvalue() ? (@.key == "name" && (@.value.type() == "string"))) && exists(@.keyvalue() ? (@.key == "secret" && (@.value.type() == "boolean"))) && !exists(@.keyvalue() ? (@.key != "name" && @.key != "secret"))))))') IS TRUE`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'organizations',
        constraint: 'organizations_invitations_shape_25a80c96',
        expression: sql`jsonb_path_match("invitations", 'strict $.type() == "array" && !exists($[*] ? (!((@.type() == "object" && !exists(@.keyvalue() ? (@.key == "clerkCreatedAt" && !(@.value.type() == "null" || (@.value.type() == "string")))) && exists(@.keyvalue() ? (@.key == "email" && (@.value.type() == "string"))) && exists(@.keyvalue() ? (@.key == "invitationId" && (@.value.type() == "string"))) && exists(@.keyvalue() ? (@.key == "role" && (@.value.type() == "string"))) && exists(@.keyvalue() ? (@.key == "status" && (@.value.type() == "string"))) && !exists(@.keyvalue() ? (@.key != "clerkCreatedAt" && @.key != "email" && @.key != "invitationId" && @.key != "role" && @.key != "status"))))))') IS TRUE`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'organizations',
        constraint: 'organizations_members_shape_15ab7947',
        expression: sql`jsonb_path_match("members", 'strict $.type() == "array" && !exists($[*] ? (!((@.type() == "object" && !exists(@.keyvalue() ? (@.key == "clerkCreatedAt" && !(@.value.type() == "null" || (@.value.type() == "string")))) && exists(@.keyvalue() ? (@.key == "email" && (@.value.type() == "string"))) && !exists(@.keyvalue() ? (@.key == "firstName" && !(@.value.type() == "null" || (@.value.type() == "string")))) && !exists(@.keyvalue() ? (@.key == "imageUrl" && !(@.value.type() == "null" || (@.value.type() == "string")))) && !exists(@.keyvalue() ? (@.key == "lastName" && !(@.value.type() == "null" || (@.value.type() == "string")))) && exists(@.keyvalue() ? (@.key == "membershipId" && (@.value.type() == "string"))) && exists(@.keyvalue() ? (@.key == "role" && (@.value.type() == "string"))) && exists(@.keyvalue() ? (@.key == "userId" && (@.value.type() == "string"))) && !exists(@.keyvalue() ? (@.key != "clerkCreatedAt" && @.key != "email" && @.key != "firstName" && @.key != "imageUrl" && @.key != "lastName" && @.key != "membershipId" && @.key != "role" && @.key != "userId"))))))') IS TRUE`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'organizations',
        constraint: 'organizations_plan_shape_016bf7c3',
        expression: sql`"plan" IS NULL OR jsonb_path_match("plan", 'strict $.type() == "null" || ($.type() == "object" && exists($.keyvalue() ? (@.key == "credits" && (@.value.type() == "number"))) && !exists($.keyvalue() ? (@.key == "downgradeTo" && !(@.value.type() == "null" || (@.value.type() == "string")))) && exists($.keyvalue() ? (@.key == "key" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "periodEnd" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "periodStart" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "startedAt" && (@.value.type() == "string"))) && !exists($.keyvalue() ? (@.key != "credits" && @.key != "downgradeTo" && @.key != "key" && @.key != "periodEnd" && @.key != "periodStart" && @.key != "startedAt")))') IS TRUE`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'personas',
        constraint: 'personas_models_shape_49461cab',
        expression: sql`jsonb_path_match("models", 'strict $.type() == "array" && !exists($[*] ? (!((@.type() == "object" && exists(@.keyvalue() ? (@.key == "model" && (@.value.type() == "string"))) && exists(@.keyvalue() ? (@.key == "when" && (@.value.type() == "string"))) && !exists(@.keyvalue() ? (@.key != "model" && @.key != "when"))))))') IS TRUE`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'runs',
        constraint: 'runs_result_shape_f81b50e5',
        expression: sql`"result" IS NULL OR jsonb_path_match("result", 'strict $.type() == "null" || ($.type() == "object" && exists($.keyvalue() ? (@.key == "notify" && (@.value.type() == "boolean"))) && exists($.keyvalue() ? (@.key == "summary" && (@.value.type() == "string"))) && !exists($.keyvalue() ? (@.key != "notify" && @.key != "summary")))') IS TRUE`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'secrets',
        constraint: 'secrets_values_shape_075c2ca7',
        expression: sql`jsonb_path_match("values", 'strict $.type() == "array" && !exists($[*] ? (!((@.type() == "object" && exists(@.keyvalue() ? (@.key == "name" && (@.value.type() == "string"))) && exists(@.keyvalue() ? (@.key == "value" && (@.value.type() == "string"))) && !exists(@.keyvalue() ? (@.key != "name" && @.key != "value"))))))') IS TRUE`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'skills',
        constraint: 'skills_files_shape_b1107585',
        expression: sql`jsonb_path_match("files", 'strict $.type() == "array" && !exists($[*] ? (!((@.type() == "object" && exists(@.keyvalue() ? (@.key == "contents" && (@.value.type() == "string"))) && exists(@.keyvalue() ? (@.key == "path" && (@.value.type() == "string"))) && !exists(@.keyvalue() ? (@.key != "contents" && @.key != "path"))))))') IS TRUE`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'skills',
        constraint: 'skills_origin_shape_4ec07a35',
        expression: sql`jsonb_path_match("origin", 'strict $.type() == "object" && !exists($.keyvalue() ? (@.key == "id" && !(@.value.type() == "null" || (@.value.type() == "string")))) && exists($.keyvalue() ? (@.key == "kind" && (@.value.type() == "string" && (@.value == "custom" || @.value == "hub" || @.value == "agent")))) && !exists($.keyvalue() ? (@.key != "id" && @.key != "kind"))') IS TRUE`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'usage',
        constraint: 'usage_browser_shape_4a346f8e',
        expression: sql`"browser" IS NULL OR jsonb_path_match("browser", 'strict $.type() == "null" || ($.type() == "object" && exists($.keyvalue() ? (@.key == "browserId" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "inputTokens" && (@.value.type() == "number"))) && exists($.keyvalue() ? (@.key == "marketCost" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "model" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "outputTokens" && (@.value.type() == "number"))) && !exists($.keyvalue() ? (@.key != "browserId" && @.key != "inputTokens" && @.key != "marketCost" && @.key != "model" && @.key != "outputTokens")))') IS TRUE`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'usage',
        constraint: 'usage_tokens_shape_c63d8867',
        expression: sql`"tokens" IS NULL OR jsonb_path_match("tokens", 'strict $.type() == "null" || ($.type() == "object" && exists($.keyvalue() ? (@.key == "cacheWriteTokens" && (@.value.type() == "number"))) && exists($.keyvalue() ? (@.key == "cachedInputTokens" && (@.value.type() == "number"))) && !exists($.keyvalue() ? (@.key == "gatewayCost" && !(@.value.type() == "null" || (@.value.type() == "string")))) && exists($.keyvalue() ? (@.key == "inputTokens" && (@.value.type() == "number"))) && !exists($.keyvalue() ? (@.key == "marketCost" && !(@.value.type() == "null" || (@.value.type() == "string")))) && exists($.keyvalue() ? (@.key == "model" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "outputTokens" && (@.value.type() == "number"))) && !exists($.keyvalue() ? (@.key == "provider" && !(@.value.type() == "null" || (@.value.type() == "string")))) && exists($.keyvalue() ? (@.key == "reasoningTokens" && (@.value.type() == "number"))) && !exists($.keyvalue() ? (@.key != "cacheWriteTokens" && @.key != "cachedInputTokens" && @.key != "gatewayCost" && @.key != "inputTokens" && @.key != "marketCost" && @.key != "model" && @.key != "outputTokens" && @.key != "provider" && @.key != "reasoningTokens")))') IS TRUE`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
