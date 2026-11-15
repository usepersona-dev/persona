#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/aa9d0504f1d76e06a2988bc9d418b474a1f625d360bca9a0d4eaeaaafab9461e/contract';
import endContract from '../../snapshots/aa9d0504f1d76e06a2988bc9d418b474a1f625d360bca9a0d4eaeaaafab9461e/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9d058d41fead8cc7eb19ba734c7d695172e03e3d9c9fd1330b7fec3fa49f99d8/contract';
import startContract from '../../snapshots/9d058d41fead8cc7eb19ba734c7d695172e03e3d9c9fd1330b7fec3fa49f99d8/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'files',
        constraint: 'files_session_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({ schema: 'public', table: 'files', index: 'files_session_id_idx_00ba47bf' }),
      this.dropColumn({ schema: 'public', table: 'files', column: 'session_id' }),
      this.dropTable({ schema: 'public', table: 'sessions' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
