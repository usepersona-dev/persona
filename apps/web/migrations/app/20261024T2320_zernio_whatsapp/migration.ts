#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/cc5d419e070e97e27571eac0dc24992d7fa467b3711572e1afc35831cffa3fab/contract';
import startContract from '../../snapshots/cc5d419e070e97e27571eac0dc24992d7fa467b3711572e1afc35831cffa3fab/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/682afb4506a115d56e8c732856de21bd738cdd3253b59c1c755c4765a5e56743/contract';
import endContract from '../../snapshots/682afb4506a115d56e8c732856de21bd738cdd3253b59c1c755c4765a5e56743/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'whatsapp_lines',
        constraint: 'whatsapp_lines_phone_number_id_key',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'links',
        constraint: 'links_channel_check_d774a31d',
      }),
      this.dropColumn({ schema: 'public', table: 'whatsapp_lines', column: 'phone_number_id' }),
      this.addColumn({
        schema: 'public',
        table: 'links',
        column: col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'whatsapp_lines',
        column: col('account_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'whatsapp_lines',
        column: col('number_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dropNotNull({ schema: 'public', table: 'whatsapp_lines', column: 'number' }),
      this.addRequiredColumnToEmptyTable({
        schema: 'public',
        table: 'whatsapp_lines',
        column: 'profile_id',
        type: 'text',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'links',
        constraint: 'links_channel_check_75243d83',
        expression: sql`"channel" IN ('whatsapp', 'whatsapp_v2', 'telegram')`,
      }),
      this.addUnique({
        schema: 'public',
        table: 'whatsapp_lines',
        constraint: 'whatsapp_lines_account_id_key',
        columns: ['account_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'whatsapp_lines',
        constraint: 'whatsapp_lines_number_id_key',
        columns: ['number_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'whatsapp_lines',
        constraint: 'whatsapp_lines_profile_id_key',
        columns: ['profile_id'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
