#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/e18460a5b9743b92dca03558bb8b4463aa48895ab5148f1b8ed2760d4b306f4f/contract';
import startContract from '../../snapshots/e18460a5b9743b92dca03558bb8b4463aa48895ab5148f1b8ed2760d4b306f4f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e48e2b7c1e8107e509502dc7deee47ee676b150bbd1969aefeb65f75f7e653c2/contract';
import endContract from '../../snapshots/e48e2b7c1e8107e509502dc7deee47ee676b150bbd1969aefeb65f75f7e653c2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, rawSql } from '@prisma/orm-postgres/migration';

// A file a persona already shared by a link in a message stays open: its id sits in that message's text, in a page link or a direct link
const SHARED_FILES_PUBLIC = `UPDATE "public"."files" SET "public" = true WHERE "id" IN (
  SELECT (regexp_matches("text", '/files/([A-Za-z0-9_-]{8,})', 'g'))[1] FROM "public"."messages" WHERE "role" = 'assistant'
  UNION
  SELECT (regexp_matches("text", 'files\\.usepersona\\.dev/[^/\\s]+/([A-Za-z0-9_-]{8,})', 'g'))[1] FROM "public"."messages" WHERE "role" = 'assistant'
)`;

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'files',
        column: col('public', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      rawSql({
        id: 'data.public.files.public',
        label: 'Files already shared by a link stay public',
        operationClass: 'data',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'column', name: 'public', table: 'files' } },
        precheck: [],
        execute: [{ description: 'mark the files a persona shared in a message as public', sql: SHARED_FILES_PUBLIC }],
        postcheck: [],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
