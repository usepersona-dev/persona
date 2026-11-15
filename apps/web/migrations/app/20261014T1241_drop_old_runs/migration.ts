#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/9d058d41fead8cc7eb19ba734c7d695172e03e3d9c9fd1330b7fec3fa49f99d8/contract';
import endContract from '../../snapshots/9d058d41fead8cc7eb19ba734c7d695172e03e3d9c9fd1330b7fec3fa49f99d8/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/5a0160f62d2c57352b91539623d9bc7737f13b10e3281165aab516af56535b4f/contract';
import startContract from '../../snapshots/5a0160f62d2c57352b91539623d9bc7737f13b10e3281165aab516af56535b4f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

// Before the old tables go, any run the old code wrote while the runs migration deployed moves into runs too, the same way that migration copied the rest
const RUN_COLUMNS = `"id", "persona_id", "source", "title", "link_id", "schedule_id", "scheduled_for", "webhook_id", "status", "session_id", "result", "created_at", "claimed_at", "ended_at"`;
const COPY_AUTOMATION_RUNS = `INSERT INTO "public"."runs" (${RUN_COLUMNS}) SELECT r."id", s."persona_id", 'automation', s."name", s."link_id", r."schedule_id", r."scheduled_for", NULL, r."status", r."session_id", r."result", r."created_at", r."claimed_at", r."ended_at" FROM "public"."schedule_runs" r JOIN "public"."schedules" s ON s."id" = r."schedule_id" ON CONFLICT DO NOTHING`;
const COPY_WEBHOOK_RUNS = `INSERT INTO "public"."runs" (${RUN_COLUMNS}) SELECT r."id", w."persona_id", 'webhook', w."name", w."link_id", NULL, NULL, r."webhook_id", r."status", r."session_id", r."result", r."created_at", r."created_at", r."ended_at" FROM "public"."webhook_runs" r JOIN "public"."webhooks" w ON w."id" = r."webhook_id" ON CONFLICT DO NOTHING`;
const ALL_RUNS_COPIED = `SELECT NOT EXISTS (SELECT 1 FROM "public"."schedule_runs" o WHERE NOT EXISTS (SELECT 1 FROM "public"."runs" n WHERE n."id" = o."id")) AND NOT EXISTS (SELECT 1 FROM "public"."webhook_runs" o WHERE NOT EXISTS (SELECT 1 FROM "public"."runs" n WHERE n."id" = o."id")) AS "result"`;

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      rawSql({
        id: 'data.runs.copy_late_runs',
        label: 'Copy runs the old code wrote during the deploy into runs',
        operationClass: 'data',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'table', name: 'runs' } },
        precheck: [],
        execute: [
          { description: 'copy the late automation runs', sql: COPY_AUTOMATION_RUNS, params: [] },
          { description: 'copy the late webhook runs', sql: COPY_WEBHOOK_RUNS, params: [] },
        ],
        postcheck: [{ description: 'every old run is in runs', sql: ALL_RUNS_COPIED, params: [] }],
      }),
      this.dropTable({ schema: 'public', table: 'schedule_runs' }),
      this.dropTable({ schema: 'public', table: 'webhook_runs' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
