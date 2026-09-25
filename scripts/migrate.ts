// Applies pending SQL migrations from db/migrations (the app also does this on first request).
// Usage: npm run db:migrate   (uses DATABASE_URL, or the embedded PGlite DB when unset)
import { closeDb, getDriver } from "../lib/db/core";

getDriver()
  .then(() => console.log("[db] migrations up to date"))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb().finally(() => process.exit()));
