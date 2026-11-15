#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/688beea1dc4a552383b68c2c27d682502e01ac4eb7c103d55ac0fc5e9c940bb2/contract';
import endContract from '../../snapshots/688beea1dc4a552383b68c2c27d682502e01ac4eb7c103d55ac0fc5e9c940bb2/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/be694d67c73f17fccd3de332fc8a4af4cbadded043348960be44ec87f0557e81/contract';
import startContract from '../../snapshots/be694d67c73f17fccd3de332fc8a4af4cbadded043348960be44ec87f0557e81/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'personas',
        constraint: 'personas_parent_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'personas',
        constraint: 'personas_snapshot_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({
        schema: 'public',
        table: 'personas',
        index: 'personas_parent_id_idx_ab33b399',
      }),
      this.dropColumn({ schema: 'public', table: 'personas', column: 'parent_id' }),
      this.dropIndex({
        schema: 'public',
        table: 'personas',
        index: 'personas_snapshot_id_idx_901ededa',
      }),
      this.dropColumn({ schema: 'public', table: 'personas', column: 'snapshot_id' }),
      this.dropTable({ schema: 'public', table: 'snapshots' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
