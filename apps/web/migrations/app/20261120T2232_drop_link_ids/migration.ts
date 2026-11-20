#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/21ba17de1b008d4716a1b1dffdffdbd9dd91f137804374cd64b54760778a964f/contract';
import startContract from '../../snapshots/21ba17de1b008d4716a1b1dffdffdbd9dd91f137804374cd64b54760778a964f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9c2e3b8c5810721bd1f562f5985036ff478b2c1943ec83c7114ce64a56526edc/contract';
import endContract from '../../snapshots/9c2e3b8c5810721bd1f562f5985036ff478b2c1943ec83c7114ce64a56526edc/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'runs',
        constraint: 'runs_link_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'schedules',
        constraint: 'schedules_link_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'triggers',
        constraint: 'triggers_link_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'webhooks',
        constraint: 'webhooks_link_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({ schema: 'public', table: 'runs', index: 'runs_link_id_idx_fdb33a76' }),
      this.dropColumn({ schema: 'public', table: 'runs', column: 'link_id' }),
      this.dropIndex({
        schema: 'public',
        table: 'schedules',
        index: 'schedules_link_id_idx_fdb33a76',
      }),
      this.dropColumn({ schema: 'public', table: 'schedules', column: 'link_id' }),
      this.dropIndex({
        schema: 'public',
        table: 'triggers',
        index: 'triggers_link_id_idx_fdb33a76',
      }),
      this.dropColumn({ schema: 'public', table: 'triggers', column: 'link_id' }),
      this.dropIndex({
        schema: 'public',
        table: 'webhooks',
        index: 'webhooks_link_id_idx_fdb33a76',
      }),
      this.dropColumn({ schema: 'public', table: 'webhooks', column: 'link_id' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
