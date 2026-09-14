import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Pure factory, deliberately without "server-only" — shared by the Next
 * app's guarded singleton (src/lib/db/client.ts) and by standalone scripts
 * (scripts/ingest-assets.ts) that run outside the Next.js runtime and
 * can't resolve "server-only" (it throws by design outside Next's
 * bundler).
 */
export function createDb(config: {
  url: string;
  authToken?: string;
}): LibSQLDatabase<typeof schema> {
  const client = createClient({ url: config.url, authToken: config.authToken });
  return drizzle(client, { schema });
}
