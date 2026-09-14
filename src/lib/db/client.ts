import "server-only";
import { createDb } from "./create-client";

// Falls back to a local SQLite file when TURSO_DATABASE_URL isn't set yet
// (e.g. `next build` without secrets configured, or local dev before a
// Turso database exists) — the Auth.js Drizzle adapter needs a real
// LibSQLDatabase instance at module-eval time to detect its dialect, so
// this can't be constructed lazily behind a Proxy.
export const db = createDb({
  url: process.env.TURSO_DATABASE_URL || "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
