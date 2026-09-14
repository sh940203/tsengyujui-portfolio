"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { adminWriteRateLimit, uploadRateLimit } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES, createUploadUrl } from "@/lib/r2/presign";
import {
  deleteObject,
  getObjectBuffer,
  verifyUploadedObject,
} from "@/lib/r2/confirm-upload";
import { R2_BUCKET, R2_ORIGINALS_BUCKET } from "@/lib/r2/client";
import { generateAndUploadVariants } from "@/lib/media/variants";
import { VARIANT_WIDTHS } from "@/lib/media/constants";

const MIME_ENUM = z.enum(["image/jpeg", "image/png", "image/webp"]);
const KIND_ENUM = z.enum([
  "final",
  "detail",
  "sketch",
  "poster",
  "process",
  "misc",
]);
const ROTATION_ENUM = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);

async function checkRateLimit(
  limiter: { limit: (key: string) => Promise<{ success: boolean }> },
  key: string,
): Promise<void> {
  const { success } = await limiter.limit(key);
  if (!success) throw new Error("RATE_LIMITED");
}

function extensionFor(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

// ── 1. 上傳：取得 presigned URL（直傳私有的 originals bucket 暫存區）───

const RequestUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: MIME_ENUM,
  contentLength: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export async function requestMediaUploadUrl(input: unknown) {
  const session = await requireAuth();
  await checkRateLimit(uploadRateLimit, session.user.id);
  const { contentType, contentLength } = RequestUploadSchema.parse(input);

  const stagingKey = `staging/${createId()}.${extensionFor(contentType)}`;
  const uploadUrl = await createUploadUrl({
    bucket: R2_ORIGINALS_BUCKET,
    key: stagingKey,
    contentType,
    contentLength,
  });

  return { uploadUrl, stagingKey };
}

// ── 2. 上傳完成：驗證 magic bytes、生成變體、寫入 media ────────────────

const FinalizeSchema = z.object({
  stagingKey: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: MIME_ENUM,
  fileSize: z.number().int().positive(),
});

export async function finalizeMediaUpload(input: unknown) {
  const session = await requireAuth();
  await checkRateLimit(uploadRateLimit, session.user.id);
  const { stagingKey, filename, mimeType, fileSize } =
    FinalizeSchema.parse(input);

  // 副檔名/Content-Type 可偽造，上傳完成後重新讀取真實檔頭 — SPEC.md §12.4
  await verifyUploadedObject(R2_ORIGINALS_BUCKET, stagingKey);
  const originalBuffer = await getObjectBuffer(R2_ORIGINALS_BUCKET, stagingKey);

  const destPrefix = `unassigned/misc/${createId()}`;
  const result = await generateAndUploadVariants({
    originalBuffer,
    rotation: 0,
    destPrefix,
  });

  await deleteObject(R2_ORIGINALS_BUCKET, stagingKey);

  const mediaId = createId();
  await db.insert(media).values({
    id: mediaId,
    r2Key: destPrefix,
    filename,
    mimeType,
    width: result.width,
    height: result.height,
    fileSize,
    rotation: 0,
    kind: "misc",
    collectionId: null,
    sortOrder: 0,
  });

  const [row] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);

  revalidatePath("/admin/media");
  return row;
}

// ── 3. 旋轉：重新生成同一 destPrefix 下的變體（覆蓋），公開 URL 不變 ────

const RotateSchema = z.object({
  mediaId: z.string().cuid2(),
  rotation: ROTATION_ENUM,
});

export async function rotateMedia(input: unknown) {
  const session = await requireAuth();
  await checkRateLimit(adminWriteRateLimit, session.user.id);
  const { mediaId, rotation } = RotateSchema.parse(input);

  const rows = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("NOT_FOUND");

  const originalKey = `${row.r2Key}/original.${extensionFor(row.mimeType ?? "image/jpeg")}`;
  const originalBuffer = await getObjectBuffer(R2_ORIGINALS_BUCKET, originalKey);

  const result = await generateAndUploadVariants({
    originalBuffer,
    rotation,
    destPrefix: row.r2Key,
  });

  await db
    .update(media)
    .set({ rotation, width: result.width, height: result.height })
    .where(eq(media.id, mediaId));

  revalidatePath("/admin/media");
}

// ── 4. 焦點 ────────────────────────────────────────────────────────

const FocalSchema = z.object({
  mediaId: z.string().cuid2(),
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
});

export async function updateMediaFocal(input: unknown) {
  const session = await requireAuth();
  await checkRateLimit(adminWriteRateLimit, session.user.id);
  const { mediaId, focalX, focalY } = FocalSchema.parse(input);

  await db.update(media).set({ focalX, focalY }).where(eq(media.id, mediaId));
  revalidatePath("/admin/media");
}

// ── 5. kind ────────────────────────────────────────────────────────

const KindSchema = z.object({
  mediaId: z.string().cuid2(),
  kind: KIND_ENUM,
});

export async function updateMediaKind(input: unknown) {
  const session = await requireAuth();
  await checkRateLimit(adminWriteRateLimit, session.user.id);
  const { mediaId, kind } = KindSchema.parse(input);

  await db.update(media).set({ kind }).where(eq(media.id, mediaId));
  revalidatePath("/admin/media");
}

// ── 6. Alt 文字 ────────────────────────────────────────────────────

const AltSchema = z.object({
  mediaId: z.string().cuid2(),
  altEn: z.string().max(300),
  altZh: z.string().max(300),
});

export async function updateMediaAlt(input: unknown) {
  const session = await requireAuth();
  await checkRateLimit(adminWriteRateLimit, session.user.id);
  const { mediaId, altEn, altZh } = AltSchema.parse(input);

  await db
    .update(media)
    .set({ altEn: altEn || null, altZh: altZh || null })
    .where(eq(media.id, mediaId));
  revalidatePath("/admin/media");
}

// ── 7. 指派系列（單筆） ─────────────────────────────────────────────

const CollectionSchema = z.object({
  mediaId: z.string().cuid2(),
  collectionId: z.string().cuid2().nullable(),
});

export async function updateMediaCollection(input: unknown) {
  const session = await requireAuth();
  await checkRateLimit(adminWriteRateLimit, session.user.id);
  const { mediaId, collectionId } = CollectionSchema.parse(input);

  await db.update(media).set({ collectionId }).where(eq(media.id, mediaId));
  revalidatePath("/admin/media");
}

// ── 8. 批次操作 ────────────────────────────────────────────────────

const MediaIdsSchema = z.array(z.string().cuid2()).min(1).max(200);

export async function batchUpdateKind(input: unknown) {
  const session = await requireAuth();
  await checkRateLimit(adminWriteRateLimit, session.user.id);
  const { mediaIds, kind } = z
    .object({ mediaIds: MediaIdsSchema, kind: KIND_ENUM })
    .parse(input);

  await db.update(media).set({ kind }).where(inArray(media.id, mediaIds));
  revalidatePath("/admin/media");
}

export async function batchUpdateCollection(input: unknown) {
  const session = await requireAuth();
  await checkRateLimit(adminWriteRateLimit, session.user.id);
  const { mediaIds, collectionId } = z
    .object({ mediaIds: MediaIdsSchema, collectionId: z.string().cuid2().nullable() })
    .parse(input);

  await db
    .update(media)
    .set({ collectionId })
    .where(inArray(media.id, mediaIds));
  revalidatePath("/admin/media");
}

export async function batchDeleteMedia(input: unknown) {
  const session = await requireAuth();
  await checkRateLimit(adminWriteRateLimit, session.user.id);
  const { mediaIds } = z.object({ mediaIds: MediaIdsSchema }).parse(input);

  const rows = await db.select().from(media).where(inArray(media.id, mediaIds));

  for (const row of rows) {
    const deletions = VARIANT_WIDTHS.map((w) =>
      deleteObject(R2_BUCKET, `${row.r2Key}/${w}.webp`).catch(() => {}),
    );
    deletions.push(
      deleteObject(
        R2_ORIGINALS_BUCKET,
        `${row.r2Key}/original.${extensionFor(row.mimeType ?? "image/jpeg")}`,
      ).catch(() => {}),
    );
    await Promise.all(deletions);
  }

  await db.delete(media).where(inArray(media.id, mediaIds));
  revalidatePath("/admin/media");
}
