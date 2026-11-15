#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5292e3a6620eb506bdf7068caacbd68bdae3c9eeb9c89910c17ffad822cd3c98/contract';
import endContract from '../../snapshots/5292e3a6620eb506bdf7068caacbd68bdae3c9eeb9c89910c17ffad822cd3c98/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b127061e0c9ff1612bc203ebb24be508ad20542c76082bad8e4a576b185e7d58/contract';
import startContract from '../../snapshots/b127061e0c9ff1612bc203ebb24be508ad20542c76082bad8e4a576b185e7d58/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'personas',
        column: col('models', 'jsonb', {
          notNull: true,
          default: lit([]),
          codecRef: { codecId: 'pg/jsonb@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
