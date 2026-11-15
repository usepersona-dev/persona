#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4c3d08763c757982a29f748291557c111adb75bc9a0fa98bf8293e3eb04da491/contract';
import endContract from '../../snapshots/4c3d08763c757982a29f748291557c111adb75bc9a0fa98bf8293e3eb04da491/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e48e2b7c1e8107e509502dc7deee47ee676b150bbd1969aefeb65f75f7e653c2/contract';
import startContract from '../../snapshots/e48e2b7c1e8107e509502dc7deee47ee676b150bbd1969aefeb65f75f7e653c2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'usage',
        column: col('sandbox', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'usage',
        constraint: 'usage_sandbox_shape_6012725a',
        expression: sql`"sandbox" IS NULL OR jsonb_path_match("sandbox", 'strict $.type() == "null" || ($.type() == "object" && exists($.keyvalue() ? (@.key == "cpuMs" && (@.value.type() == "number"))) && exists($.keyvalue() ? (@.key == "marketCost" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "memoryMb" && (@.value.type() == "number"))) && exists($.keyvalue() ? (@.key == "runMs" && (@.value.type() == "number"))) && exists($.keyvalue() ? (@.key == "sandboxId" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "totalCpuMs" && (@.value.type() == "number"))) && exists($.keyvalue() ? (@.key == "totalRunMs" && (@.value.type() == "number"))) && !exists($.keyvalue() ? (@.key != "cpuMs" && @.key != "marketCost" && @.key != "memoryMb" && @.key != "runMs" && @.key != "sandboxId" && @.key != "totalCpuMs" && @.key != "totalRunMs")))') IS TRUE`,
      }),
      this.createIndex({
        schema: 'public',
        table: 'usage',
        index: 'usage_session_id_at_idx_0d730bf2',
        columns: ['session_id', 'at'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
