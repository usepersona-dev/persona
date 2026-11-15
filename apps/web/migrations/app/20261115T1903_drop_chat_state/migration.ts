#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/43e96dc21f4c4fc26b65f346062a6b9c41e71be9fc935258cfaa982f01f139de/contract';
import startContract from '../../snapshots/43e96dc21f4c4fc26b65f346062a6b9c41e71be9fc935258cfaa982f01f139de/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/4c3d08763c757982a29f748291557c111adb75bc9a0fa98bf8293e3eb04da491/contract';
import endContract from '../../snapshots/4c3d08763c757982a29f748291557c111adb75bc9a0fa98bf8293e3eb04da491/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropTable({ schema: 'public', table: 'chat_state_cache' }),
      this.dropTable({ schema: 'public', table: 'chat_state_lists' }),
      this.dropTable({ schema: 'public', table: 'chat_state_locks' }),
      this.dropTable({ schema: 'public', table: 'chat_state_queues' }),
      this.dropTable({ schema: 'public', table: 'chat_state_subscriptions' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
