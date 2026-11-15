#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/7365797e8583554107f1296ac88045fbe7deb16207f0019c9329382fc569ba48/contract';
import startContract from '../../snapshots/7365797e8583554107f1296ac88045fbe7deb16207f0019c9329382fc569ba48/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/5a0160f62d2c57352b91539623d9bc7737f13b10e3281165aab516af56535b4f/contract';
import endContract from '../../snapshots/5a0160f62d2c57352b91539623d9bc7737f13b10e3281165aab516af56535b4f/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  rawSql,
} from '@prisma/orm-postgres/migration';

// Every old run moves into runs with its id kept; it takes its persona, title and chat from its automation or webhook. A run that is already there is left alone.
const RUN_COLUMNS = `"id", "persona_id", "source", "title", "link_id", "schedule_id", "scheduled_for", "webhook_id", "status", "session_id", "result", "created_at", "claimed_at", "ended_at"`;
const COPY_AUTOMATION_RUNS = `INSERT INTO "public"."runs" (${RUN_COLUMNS}) SELECT r."id", s."persona_id", 'automation', s."name", s."link_id", r."schedule_id", r."scheduled_for", NULL, r."status", r."session_id", r."result", r."created_at", r."claimed_at", r."ended_at" FROM "public"."schedule_runs" r JOIN "public"."schedules" s ON s."id" = r."schedule_id" ON CONFLICT DO NOTHING`;
const COPY_WEBHOOK_RUNS = `INSERT INTO "public"."runs" (${RUN_COLUMNS}) SELECT r."id", w."persona_id", 'webhook', w."name", w."link_id", NULL, NULL, r."webhook_id", r."status", r."session_id", r."result", r."created_at", r."created_at", r."ended_at" FROM "public"."webhook_runs" r JOIN "public"."webhooks" w ON w."id" = r."webhook_id" ON CONFLICT DO NOTHING`;
const ALL_RUNS_COPIED = `SELECT NOT EXISTS (SELECT 1 FROM "public"."schedule_runs" o WHERE NOT EXISTS (SELECT 1 FROM "public"."runs" n WHERE n."id" = o."id")) AND NOT EXISTS (SELECT 1 FROM "public"."webhook_runs" o WHERE NOT EXISTS (SELECT 1 FROM "public"."runs" n WHERE n."id" = o."id")) AS "result"`;

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'runs',
        columns: [
          col('claimed_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('ended_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('link_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('persona_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('result', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('schedule_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('scheduled_for', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('session_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('running'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('webhook_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('runs_source_check_e052350f', `"source" IN ('automation', 'webhook')`),
          checkExpression(
            'runs_status_check_77fab0ab',
            `"status" IN ('running', 'completed', 'failed')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'runs',
        constraint: 'runs_schedule_id_scheduled_for_key',
        columns: ['schedule_id', 'scheduled_for'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'runs',
        index: 'runs_link_id_idx_fdb33a76',
        columns: ['link_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'runs',
        index: 'runs_persona_id_idx_840c67e2',
        columns: ['persona_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'runs',
        index: 'runs_schedule_id_idx_83757f9e',
        columns: ['schedule_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'runs',
        index: 'runs_status_claimed_at_idx_3c06d0b9',
        columns: ['status', 'claimed_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'runs',
        index: 'runs_webhook_id_idx_bc5fb5d1',
        columns: ['webhook_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'runs',
        foreignKey: {
          name: 'runs_persona_id_fkey',
          columns: ['persona_id'],
          references: { schema: 'public', table: 'personas', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'runs',
        foreignKey: {
          name: 'runs_link_id_fkey',
          columns: ['link_id'],
          references: { schema: 'public', table: 'links', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'runs',
        foreignKey: {
          name: 'runs_schedule_id_fkey',
          columns: ['schedule_id'],
          references: { schema: 'public', table: 'schedules', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'runs',
        foreignKey: {
          name: 'runs_webhook_id_fkey',
          columns: ['webhook_id'],
          references: { schema: 'public', table: 'webhooks', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      rawSql({
        id: 'data.runs.copy_old_runs',
        label: 'Copy schedule_runs and webhook_runs into runs',
        operationClass: 'data',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'table', name: 'runs' } },
        precheck: [],
        execute: [
          { description: 'copy the automation runs', sql: COPY_AUTOMATION_RUNS, params: [] },
          { description: 'copy the webhook runs', sql: COPY_WEBHOOK_RUNS, params: [] },
        ],
        postcheck: [{ description: 'every old run is in runs', sql: ALL_RUNS_COPIED, params: [] }],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
