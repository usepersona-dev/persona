#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/43e96dc21f4c4fc26b65f346062a6b9c41e71be9fc935258cfaa982f01f139de/contract';
import endContract from '../../snapshots/43e96dc21f4c4fc26b65f346062a6b9c41e71be9fc935258cfaa982f01f139de/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/4c3d08763c757982a29f748291557c111adb75bc9a0fa98bf8293e3eb04da491/contract';
import startContract from '../../snapshots/4c3d08763c757982a29f748291557c111adb75bc9a0fa98bf8293e3eb04da491/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey, rawSql, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      // Databases from before this migration keep the Chat SDK's state in schema "chat", which a search_path setting on the database put first. That state lives a week at most, so it goes, and the tables below start empty in "public".
      // DROP SCHEMA without CASCADE fails, and so changes nothing, if anything else is in "chat". A new database has neither, so the postcheck holds and this step is skipped
      rawSql({
        id: 'chat-state.drop-chat-schema',
        label: 'Drop the old Chat SDK state in schema "chat" and the search_path setting that pointed at it',
        operationClass: 'destructive',
        target: { id: 'postgres', details: { schema: 'chat', objectType: 'dependency', name: 'chat' } },
        precheck: [],
        execute: [
          {
            description: 'drop the Chat SDK tables in schema "chat"',
            sql: 'DROP TABLE IF EXISTS "chat"."chat_state_subscriptions", "chat"."chat_state_locks", "chat"."chat_state_cache", "chat"."chat_state_lists", "chat"."chat_state_queues"',
          },
          { description: 'drop schema "chat"', sql: 'DROP SCHEMA IF EXISTS "chat"' },
          { description: 'drop the search_path setting on the database', sql: `DO $$ BEGIN EXECUTE format('ALTER DATABASE %I RESET search_path', current_database()); END $$` },
        ],
        postcheck: [
          {
            description: 'verify schema "chat" is gone and the database sets no search_path',
            sql: `SELECT NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'chat') AND NOT EXISTS (SELECT 1 FROM pg_db_role_setting AS s INNER JOIN pg_database AS d ON d.oid = s.setdatabase WHERE d.datname = current_database() AND s.setrole = 0 AND EXISTS (SELECT 1 FROM unnest(s.setconfig) AS c WHERE c LIKE 'search_path=%')) AS "result"`,
          },
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'chat_state_cache',
        columns: [
          col('cache_key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expires_at', 'timestamptz(6)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 6 } },
          }),
          col('key_prefix', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz(6)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 6 } },
          }),
          col('value', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['key_prefix', 'cache_key'], { name: 'chat_state_cache_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'chat_state_lists',
        columns: [
          col('expires_at', 'timestamptz(6)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 6 } },
          }),
          col('key_prefix', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('list_key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('seq', 'BIGSERIAL', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('value', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['key_prefix', 'list_key', 'seq'], { name: 'chat_state_lists_pkey' }),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'chat_state_locks',
        columns: [
          col('expires_at', 'timestamptz(6)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 6 } },
          }),
          col('key_prefix', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('thread_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('token', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz(6)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 6 } },
          }),
        ],
        constraints: [primaryKey(['key_prefix', 'thread_id'], { name: 'chat_state_locks_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'chat_state_queues',
        columns: [
          col('expires_at', 'timestamptz(6)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 6 } },
          }),
          col('key_prefix', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('seq', 'BIGSERIAL', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('thread_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('value', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['key_prefix', 'thread_id', 'seq'], { name: 'chat_state_queues_pkey' }),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'chat_state_subscriptions',
        columns: [
          col('created_at', 'timestamptz(6)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 6 } },
          }),
          col('key_prefix', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('thread_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['key_prefix', 'thread_id'], { name: 'chat_state_subscriptions_pkey' }),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chat_state_cache',
        index: 'chat_state_cache_expires_idx',
        columns: ['expires_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chat_state_lists',
        index: 'chat_state_lists_expires_idx',
        columns: ['expires_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chat_state_locks',
        index: 'chat_state_locks_expires_idx',
        columns: ['expires_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chat_state_queues',
        index: 'chat_state_queues_expires_idx',
        columns: ['expires_at'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
