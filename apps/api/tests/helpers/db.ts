import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@g-fund/db';
import { like } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:root123456@127.0.0.1:5432/gfund';

let pool: Pool | null = null;

export async function getTestDb() {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
  }
  return drizzle(pool, { schema });
}

export async function cleanupByPrefix(prefix: string) {
  const db = await getTestDb();
  await db.delete(schema.dcaSnapshots).where(like(schema.dcaSnapshots.fundCode, `${prefix}%`));
  await db.delete(schema.slpSignalsLog).where(like(schema.slpSignalsLog.fundCode, `${prefix}%`));
  await db.delete(schema.fundNavHistory).where(like(schema.fundNavHistory.fundCode, `${prefix}%`));
  await db.delete(schema.positions).where(like(schema.positions.fundCode, `${prefix}%`));
  await db.delete(schema.funds).where(like(schema.funds.code, `${prefix}%`));
}

export async function closeTestDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
