// Database access shared by the Next.js server and the CLI scripts.
// Uses PostgreSQL when DATABASE_URL is set, otherwise an embedded PGlite database in ./.data.
import fs from "node:fs";
import path from "node:path";

export type Row = Record<string, unknown>;

export interface Queryable {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
}

/** Inside a transaction: parameterised queries plus multi-statement scripts. */
export interface TxQueryable extends Queryable {
  exec(sql: string): Promise<void>;
}

interface Driver extends Queryable {
  /** Runs a multi-statement SQL script (no parameters). */
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (q: TxQueryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// int8 -> number, numeric -> number, date -> 'YYYY-MM-DD' string (no timezone shifting)
const OID_INT8 = 20;
const OID_NUMERIC = 1700;
const OID_DATE = 1082;

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Karachi";

async function createPgDriver(url: string): Promise<Driver> {
  const pg = await import("pg");
  const { Pool, types } = pg.default ?? pg;
  types.setTypeParser(OID_INT8, (v: string) => Number(v));
  types.setTypeParser(OID_NUMERIC, (v: string) => Number(v));
  types.setTypeParser(OID_DATE, (v: string) => v);
  const pool = new Pool({ connectionString: url, max: 10, options: `-c TimeZone=${APP_TIMEZONE}` });
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pool.query(text, params)).rows as T[];
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async transaction<T>(fn: (q: TxQueryable) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          query: async <R>(text: string, params: unknown[] = []) =>
            (await client.query(text, params)).rows as R[],
          exec: async (sql: string) => {
            await client.query(sql);
          },
        });
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function createPgliteDriver(): Promise<Driver> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = await PGlite.create(dataDir, {
    parsers: {
      [OID_INT8]: (v: string) => Number(v),
      [OID_NUMERIC]: (v: string) => Number(v),
      [OID_DATE]: (v: string) => v,
    },
  });
  await db.exec(`SET TIME ZONE '${APP_TIMEZONE.replace(/'/g, "")}'`);
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await db.query(text, params)).rows as T[];
    },
    async exec(sql: string) {
      await db.exec(sql);
    },
    async transaction<T>(fn: (q: TxQueryable) => Promise<T>) {
      return db.transaction(async (t) =>
        fn({
          query: async <R>(text: string, params: unknown[] = []) => (await t.query(text, params)).rows as R[],
          exec: async (sql: string) => {
            await t.exec(sql);
          },
        }),
      );
    },
    close: () => db.close(),
  };
}

// Serialises migrations/seeding when several server instances cold-start at once (e.g. on Vercel).
const MIGRATION_LOCK = 724301;

async function runMigrations(driver: Driver) {
  const dir = path.join(process.cwd(), "db", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  await driver.transaction(async (q) => {
    await q.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK]);
    await q.exec(
      "CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const applied = new Set((await q.query<{ name: string }>("SELECT name FROM _migrations")).map((r) => r.name));
    for (const file of files) {
      if (applied.has(file)) continue;
      await q.exec(fs.readFileSync(path.join(dir, file), "utf8"));
      await q.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      console.log(`[db] applied migration ${file}`);
    }
  });
  if (process.env.SEED_DEMO_DATA === "true") {
    const { seedDemoData } = await import("./seed-demo");
    await driver.transaction(async (q) => {
      await q.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK]);
      await seedDemoData(q);
    });
  }
}

const globalForDb = globalThis as unknown as { __aghoshDb?: Promise<Driver> };

export function getDriver(): Promise<Driver> {
  if (!globalForDb.__aghoshDb) {
    globalForDb.__aghoshDb = (async () => {
      const url = process.env.DATABASE_URL;
      if (!url && process.env.VERCEL) {
        throw new Error("DATABASE_URL is not set. Serverless hosts need a hosted PostgreSQL database (e.g. Neon or Supabase).");
      }
      const driver = url ? await createPgDriver(url) : await createPgliteDriver();
      await runMigrations(driver);
      return driver;
    })().catch((err) => {
      globalForDb.__aghoshDb = undefined;
      throw err;
    });
  }
  return globalForDb.__aghoshDb;
}

export async function query<T = Row>(text: string, params?: unknown[]): Promise<T[]> {
  return (await getDriver()).query<T>(text, params);
}

export async function one<T = Row>(text: string, params?: unknown[]): Promise<T | undefined> {
  return (await query<T>(text, params))[0];
}

export async function tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  return (await getDriver()).transaction(fn);
}

export async function closeDb() {
  if (globalForDb.__aghoshDb) await (await globalForDb.__aghoshDb).close();
  globalForDb.__aghoshDb = undefined;
}
