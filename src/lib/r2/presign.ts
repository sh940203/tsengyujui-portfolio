import "server-only";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2 } from "./client";

// 副檔名 / MIME 白名單 + 大小上限 — SPEC.md §12.4 驗證順序 1–3
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
const PRESIGNED_URL_TTL_SECONDS = 5 * 60;

export class UploadValidationError extends Error {}

export async function createUploadUrl(params: {
  bucket: string;
  key: string;
  contentType: string;
  contentLength: number;
}): Promise<string> {
  const { bucket, key, contentType, contentLength } = params;

  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    throw new UploadValidationError("UNSUPPORTED_MIME_TYPE");
  }
  if (contentLength <= 0 || contentLength > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError("FILE_TOO_LARGE");
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  return getSignedUrl(r2, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });
}
