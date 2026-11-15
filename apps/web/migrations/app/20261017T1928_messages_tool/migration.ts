#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/a8a5a68d6e531105ababfd4e280b0cc62af9d8132ccfce9660ab1358d4b4d050/contract';
import startContract from '../../snapshots/a8a5a68d6e531105ababfd4e280b0cc62af9d8132ccfce9660ab1358d4b4d050/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/be694d67c73f17fccd3de332fc8a4af4cbadded043348960be44ec87f0557e81/contract';
import endContract from '../../snapshots/be694d67c73f17fccd3de332fc8a4af4cbadded043348960be44ec87f0557e81/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'messages',
        column: col('tool', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
