import { S3Client } from "@aws-sdk/client-s3";

/**
 * Pure factory, deliberately without "server-only" — this is shared by the
 * Next app's guarded singleton (src/lib/r2/client.ts) and by standalone
 * scripts (scripts/ingest-assets.ts) that run outside the Next.js runtime
 * and can't resolve "server-only" (it throws by design outside Next's
 * bundler, so the guarded modules can't be imported directly from a plain
 * Node/tsx script).
 */
export function createR2Client(config: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}
