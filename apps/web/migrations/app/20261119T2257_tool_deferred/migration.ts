#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/161f68312fc87aeeaa127a7351c7fbc2901868b72b0d13e556991a76268c1840/contract';
import startContract from '../../snapshots/161f68312fc87aeeaa127a7351c7fbc2901868b72b0d13e556991a76268c1840/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/586d8ff6a9485cce2ca8b5db9553a9345883d605d72dd2075fafe796fc804b07/contract';
import endContract from '../../snapshots/586d8ff6a9485cce2ca8b5db9553a9345883d605d72dd2075fafe796fc804b07/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'tools',
        column: col('deferred', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
