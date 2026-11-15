#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b51da08560859588ce7f6c94ff175b845bfad2185206904041bd22267647e7b3/contract';
import endContract from '../../snapshots/b51da08560859588ce7f6c94ff175b845bfad2185206904041bd22267647e7b3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/0b586978c67ece50457318d94bd9d29bde1137030704a6b22325f483fc6d85fd/contract';
import startContract from '../../snapshots/0b586978c67ece50457318d94bd9d29bde1137030704a6b22325f483fc6d85fd/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'runs',
        constraint: 'runs_schedule_id_fkey',
        kind: 'foreignKey',
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'runs',
        foreignKey: {
          name: 'runs_schedule_id_fkey',
          columns: ['schedule_id'],
          references: { schema: 'public', table: 'schedules', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
