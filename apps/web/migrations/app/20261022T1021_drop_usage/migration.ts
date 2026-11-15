#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/cc5d419e070e97e27571eac0dc24992d7fa467b3711572e1afc35831cffa3fab/contract';
import endContract from '../../snapshots/cc5d419e070e97e27571eac0dc24992d7fa467b3711572e1afc35831cffa3fab/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6bd3ca1d1b00235f59c4840c193cb901401f235e4df212f7c719714d538e8dd3/contract';
import startContract from '../../snapshots/6bd3ca1d1b00235f59c4840c193cb901401f235e4df212f7c719714d538e8dd3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.dropTable({ schema: 'public', table: 'usage' })];
  }
}

MigrationCLI.run(import.meta.url, M);
