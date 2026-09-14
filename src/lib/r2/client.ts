import "server-only";
import { createR2Client } from "./create-client";

export const r2 = createR2Client({
  accountId: process.env.R2_ACCOUNT_ID!,
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME!;
// 私有 bucket，僅存放 original.*——與公開的 R2_BUCKET 分開（SPEC.md §12.4 方案 A）
export const R2_ORIGINALS_BUCKET = process.env.R2_ORIGINALS_BUCKET_NAME!;
