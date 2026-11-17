#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/dab5eb8a8acb14153e94f4f800fe8bbda34809c0ab4d233612977a4dee9c5d98/contract';
import startContract from '../../snapshots/dab5eb8a8acb14153e94f4f800fe8bbda34809c0ab4d233612977a4dee9c5d98/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f46f7e5fcc90f0fe22e62ff227ff51e93cce19952a25ecedb7504cb45a5012d0/contract';
import endContract from '../../snapshots/f46f7e5fcc90f0fe22e62ff227ff51e93cce19952a25ecedb7504cb45a5012d0/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'usage',
        constraint: 'usage_image_shape_b1f49dfc',
      }),
      this.fillStoredKey({
        schema: 'public',
        table: 'usage',
        column: 'image',
        path: '$.outputTokens',
        value: 0,
        field: 'ImageUsage.outputTokens',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'usage',
        constraint: 'usage_image_shape_2e146052',
        expression: sql`"image" IS NULL OR jsonb_path_match("image", 'strict $.type() == "null" || ($.type() == "object" && exists($.keyvalue() ? (@.key == "images" && (@.value.type() == "number"))) && exists($.keyvalue() ? (@.key == "inputTokens" && (@.value.type() == "number"))) && exists($.keyvalue() ? (@.key == "marketCost" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "model" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "outputTokens" && (@.value.type() == "number"))) && exists($.keyvalue() ? (@.key == "reasoningTokens" && (@.value.type() == "number"))) && exists($.keyvalue() ? (@.key == "size" && (@.value.type() == "string"))) && !exists($.keyvalue() ? (@.key != "images" && @.key != "inputTokens" && @.key != "marketCost" && @.key != "model" && @.key != "outputTokens" && @.key != "reasoningTokens" && @.key != "size")))') IS TRUE`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
