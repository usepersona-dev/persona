import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import { attachDatabasePool } from '@vercel/functions';
import pg from 'pg';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

export const contract = contractFromJson<Contract>(contractJson);

// DATABASE_POOLED_URL points at PgBouncer where one runs; migrations keep DATABASE_URL, the direct address
export const pool = new pg.Pool({ connectionString: process.env['DATABASE_POOLED_URL'] || process.env['DATABASE_URL']!, max: 8, idleTimeoutMillis: 5000 });
attachDatabasePool(pool);

export const db = postgres({ contract, pg: pool, });
