#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/e18460a5b9743b92dca03558bb8b4463aa48895ab5148f1b8ed2760d4b306f4f/contract';
import endContract from '../../snapshots/e18460a5b9743b92dca03558bb8b4463aa48895ab5148f1b8ed2760d4b306f4f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f7a3600a0c2d499ffc0998f3f8ee39b6a1a433c559da7a3e275a81cd6bd8a250/contract';
import startContract from '../../snapshots/f7a3600a0c2d499ffc0998f3f8ee39b6a1a433c559da7a3e275a81cd6bd8a250/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'organizations',
        constraint: 'organizations_stripe_customer_id_key',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'organizations',
        constraint: 'organizations_plan_shape_016bf7c3',
      }),
      this.dropColumn({ schema: 'public', table: 'organizations', column: 'plan' }),
      this.dropColumn({ schema: 'public', table: 'organizations', column: 'stripe_customer_id' }),
      this.dropTable({ schema: 'public', table: 'report_requests' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
