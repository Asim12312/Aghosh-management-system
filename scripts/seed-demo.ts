// Loads the demo dataset into an empty database. Usage: npm run db:seed-demo
// (uses DATABASE_URL, or the embedded PGlite DB when unset; stop `next dev` first when using PGlite)
process.env.SEED_DEMO_DATA = "true";

import("../lib/db/core")
  .then(async ({ getDriver, query, closeDb }) => {
    await getDriver();
    const [{ n }] = await query<{ n: number }>("SELECT count(*)::int AS n FROM items");
    console.log(`[db] ready — ${n} items. Seeding is skipped if the database already had users.`);
    await closeDb();
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
