import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

async function ensureDatabase(connectionString: string) {
  const url = new URL(connectionString);
  const dbName = url.pathname.slice(1);
  url.pathname = '/postgres';
  const adminPool = new Pool({ connectionString: url.toString() });
  try {
    const { rows } = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (rows.length === 0) {
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`created database: ${dbName}`);
    }
  } finally {
    await adminPool.end();
  }
}

export async function runMigrations(connectionString: string) {
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  await ensureDatabase(connectionString);

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = join(__dirname, 'migrations');
    const files = readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM _migrations WHERE filename = $1',
        [file],
      );
      if (rows.length > 0) {
        console.log(`skip: ${file}`);
        continue;
      }
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations(filename) VALUES($1)', [file]);
      await client.query('COMMIT');
      console.log(`applied: ${file}`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  runMigrations(connectionString).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
