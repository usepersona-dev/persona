#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/824ceff79a430cc04fa3244fb369de965adb39412111af0339ad59a61cd001d3/contract';
import startContract from '../../snapshots/824ceff79a430cc04fa3244fb369de965adb39412111af0339ad59a61cd001d3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a26224642fc438b4f99157e48911b3167093f1f43ad7628fe9cdd3595eab6d90/contract';
import endContract from '../../snapshots/a26224642fc438b4f99157e48911b3167093f1f43ad7628fe9cdd3595eab6d90/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'usage',
        column: col('browser', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
