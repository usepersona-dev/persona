#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/dab5eb8a8acb14153e94f4f800fe8bbda34809c0ab4d233612977a4dee9c5d98/contract';
import endContract from '../../snapshots/dab5eb8a8acb14153e94f4f800fe8bbda34809c0ab4d233612977a4dee9c5d98/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ecf2dd927f84690f6ccfa79a238d7e44e6cb4e4c49f22cf93e0bf5f175a13928/contract';
import startContract from '../../snapshots/ecf2dd927f84690f6ccfa79a238d7e44e6cb4e4c49f22cf93e0bf5f175a13928/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'usage',
        column: col('image', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usage',
        column: col('speech', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usage',
        column: col('transcription', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usage',
        column: col('video', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'usage',
        constraint: 'usage_image_shape_b1f49dfc',
        expression: sql`"image" IS NULL OR jsonb_path_match("image", 'strict $.type() == "null" || ($.type() == "object" && exists($.keyvalue() ? (@.key == "images" && (@.value.type() == "number"))) && exists($.keyvalue() ? (@.key == "inputTokens" && (@.value.type() == "number"))) && exists($.keyvalue() ? (@.key == "marketCost" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "model" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "reasoningTokens" && (@.value.type() == "number"))) && exists($.keyvalue() ? (@.key == "size" && (@.value.type() == "string"))) && !exists($.keyvalue() ? (@.key != "images" && @.key != "inputTokens" && @.key != "marketCost" && @.key != "model" && @.key != "reasoningTokens" && @.key != "size")))') IS TRUE`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'usage',
        constraint: 'usage_speech_shape_36ed271e',
        expression: sql`"speech" IS NULL OR jsonb_path_match("speech", 'strict $.type() == "null" || ($.type() == "object" && exists($.keyvalue() ? (@.key == "characters" && (@.value.type() == "number"))) && exists($.keyvalue() ? (@.key == "marketCost" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "model" && (@.value.type() == "string"))) && !exists($.keyvalue() ? (@.key != "characters" && @.key != "marketCost" && @.key != "model")))') IS TRUE`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'usage',
        constraint: 'usage_transcription_shape_8c236982',
        expression: sql`"transcription" IS NULL OR jsonb_path_match("transcription", 'strict $.type() == "null" || ($.type() == "object" && exists($.keyvalue() ? (@.key == "marketCost" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "model" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "seconds" && (@.value.type() == "string"))) && !exists($.keyvalue() ? (@.key != "marketCost" && @.key != "model" && @.key != "seconds")))') IS TRUE`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'usage',
        constraint: 'usage_video_shape_ff1e03c5',
        expression: sql`"video" IS NULL OR jsonb_path_match("video", 'strict $.type() == "null" || ($.type() == "object" && exists($.keyvalue() ? (@.key == "audio" && (@.value.type() == "boolean"))) && exists($.keyvalue() ? (@.key == "marketCost" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "model" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "resolution" && (@.value.type() == "string"))) && exists($.keyvalue() ? (@.key == "seconds" && (@.value.type() == "number"))) && !exists($.keyvalue() ? (@.key != "audio" && @.key != "marketCost" && @.key != "model" && @.key != "resolution" && @.key != "seconds")))') IS TRUE`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
