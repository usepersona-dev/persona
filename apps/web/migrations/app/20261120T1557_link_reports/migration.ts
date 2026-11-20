#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/21ba17de1b008d4716a1b1dffdffdbd9dd91f137804374cd64b54760778a964f/contract';
import endContract from '../../snapshots/21ba17de1b008d4716a1b1dffdffdbd9dd91f137804374cd64b54760778a964f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/586d8ff6a9485cce2ca8b5db9553a9345883d605d72dd2075fafe796fc804b07/contract';
import startContract from '../../snapshots/586d8ff6a9485cce2ca8b5db9553a9345883d605d72dd2075fafe796fc804b07/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'links',
        column: col('reports', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
