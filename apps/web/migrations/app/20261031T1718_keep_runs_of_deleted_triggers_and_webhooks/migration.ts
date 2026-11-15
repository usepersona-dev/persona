#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/b51da08560859588ce7f6c94ff175b845bfad2185206904041bd22267647e7b3/contract';
import startContract from '../../snapshots/b51da08560859588ce7f6c94ff175b845bfad2185206904041bd22267647e7b3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/26b72ac3685dc4a59bcbaf6f3587b48a9354e332cc8db23c8e844c329d761795/contract';
import endContract from '../../snapshots/26b72ac3685dc4a59bcbaf6f3587b48a9354e332cc8db23c8e844c329d761795/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'runs',
        constraint: 'runs_trigger_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'runs',
        constraint: 'runs_webhook_id_fkey',
        kind: 'foreignKey',
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'runs',
        foreignKey: {
          name: 'runs_trigger_id_fkey',
          columns: ['trigger_id'],
          references: { schema: 'public', table: 'triggers', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'runs',
        foreignKey: {
          name: 'runs_webhook_id_fkey',
          columns: ['webhook_id'],
          references: { schema: 'public', table: 'webhooks', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
