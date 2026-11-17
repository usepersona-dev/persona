#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/088bce71e784ecdd7cc3a1b0a2fe8accec4987f33204c47221c7e4ae32b4c66a/contract';
import endContract from '../../snapshots/088bce71e784ecdd7cc3a1b0a2fe8accec4987f33204c47221c7e4ae32b4c66a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f46f7e5fcc90f0fe22e62ff227ff51e93cce19952a25ecedb7504cb45a5012d0/contract';
import startContract from '../../snapshots/f46f7e5fcc90f0fe22e62ff227ff51e93cce19952a25ecedb7504cb45a5012d0/contract.json' with { type: 'json' };
import { asNamespaceId } from '@prisma/orm-postgres/contract/types';
import { Migration, MigrationCLI, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'links',
        constraint: 'links_channel_check_09e64f4c',
      }),
      this.dropTable({ schema: 'public', table: 'whatsapp_lines' }),
      this.removeStoredValue({
        schema: 'public',
        table: 'links',
        column: 'channel',
        value: 'whatsapp_v2',
        codecRef: { codecId: 'pg/text@1' },
        enumValue: { namespaceId: asNamespaceId('public'), enum: 'Channel', member: 'whatsapp_v2' },
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'links',
        constraint: 'links_channel_check_b321d83f',
        expression: sql`"channel" IN ('whatsapp', 'whatsapp_meta', 'telegram')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
