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
import { ROTATION_STATES, baseKeyOf, versionedKey } from "@/lib/media/keys";

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


/**
 * 圖庫的任何變更都可能影響前台（系列頁長廊直接讀 media 表、首頁拼貼與輪播、關於頁證書），
 * 2026-10-22 之前只重新驗證 `/admin/media`——改了類型、替代文字、系列或刪圖之後，前台要等
 * 下次自然更新才看得到。統一走這支。
 */
function revalidateMediaEverywhere() {
  revalidatePath("/admin/media");
  revalidatePath("/admin");
  revalidatePath("/admin/collections", "layout");
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/work/[slug]", "page");
}

/** 換系列時，舊系列的長廊順序/隱藏/精選不能跟著帶過去（會讓新系列被誤判成「有自訂順序」）。 */
const RESET_GALLERY_STATE = { galleryOrder: null, galleryHidden: false, featuredOrder: null } as const;

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

// ── 3. 旋轉：把新變體放到「新的網址前綴」，資料庫 r2Key 改指向它 ────────
//
// 不覆蓋同一個網址（變體是一年 immutable 快取，覆蓋後瀏覽器/CDN 不會重抓，
// 縮圖與前台都不會變）——見 `src/lib/media/keys.ts`。順序是「先上傳新變體、
// 再改資料庫」：中途失敗時資料庫仍指向完好的舊前綴，不會出現指向不存在物件
// 的狀態。舊前綴的變體**刻意不立刻刪**：首頁等靜態頁面在重新驗證前，HTML
// 裡還是舊網址，刪掉會變成破圖；殘留的舊變體會在刪除這張圖時一併清掉。

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

  const baseKey = baseKeyOf(row.r2Key);
  const newKey = versionedKey(baseKey, rotation);
  if (newKey === row.r2Key) {
    return { rotation, r2Key: row.r2Key, width: row.width, height: row.height };
  }

  const originalKey = `${baseKey}/original.${extensionFor(row.mimeType ?? "image/jpeg")}`;
  const originalBuffer = await getObjectBuffer(R2_ORIGINALS_BUCKET, originalKey);

  const result = await generateAndUploadVariants({
    originalBuffer,
    rotation,
    destPrefix: newKey,
    uploadOriginal: false,
  });

  await db
    .update(media)
    .set({ r2Key: newKey, rotation, width: result.width, height: result.height })
    .where(eq(media.id, mediaId));

  // 首頁、關於頁是靜態產生的，HTML 裡寫著舊網址，要重新驗證才會換成新的
  revalidateMediaEverywhere();

  return { rotation, r2Key: newKey, width: result.width, height: result.height };
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
  revalidateMediaEverywhere();
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
  revalidateMediaEverywhere();
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
  revalidateMediaEverywhere();
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

  const [current] = await db.select({ collectionId: media.collectionId }).from(media).where(eq(media.id, mediaId)).limit(1);
  await db
    .update(media)
    .set(current?.collectionId === collectionId ? { collectionId } : { collectionId, ...RESET_GALLERY_STATE })
    .where(eq(media.id, mediaId));
  revalidateMediaEverywhere();
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
  revalidateMediaEverywhere();
}

export async function batchUpdateCollection(input: unknown) {
  const session = await requireAuth();
  await checkRateLimit(adminWriteRateLimit, session.user.id);
  const { mediaIds, collectionId } = z
    .object({ mediaIds: MediaIdsSchema, collectionId: z.string().cuid2().nullable() })
    .parse(input);

  // 只重設「真的換了系列」的那些（已經在目標系列的圖保留它的長廊狀態）
  const rows = await db.select({ id: media.id, collectionId: media.collectionId }).from(media).where(inArray(media.id, mediaIds));
  const moving = rows.filter((r) => r.collectionId !== collectionId).map((r) => r.id);
  if (moving.length > 0) {
    await db
      .update(media)
      .set({ collectionId, ...RESET_GALLERY_STATE })
      .where(inArray(media.id, moving));
  }
  revalidateMediaEverywhere();
}

export async function batchDeleteMedia(input: unknown) {
  const session = await requireAuth();
  await checkRateLimit(adminWriteRateLimit, session.user.id);
  const { mediaIds } = z.object({ mediaIds: MediaIdsSchema }).parse(input);

  const rows = await db.select().from(media).where(inArray(media.id, mediaIds));

  for (const row of rows) {
    // 這張圖曾經旋轉過的每個狀態都可能留有變體（舊前綴不會在旋轉當下刪掉，
    // 見 rotateMedia 的說明）：基底本身＋四個角度的前綴全部清一遍，
    // 沒有的物件刪除會直接略過。原檔只在基底前綴。
    const baseKey = baseKeyOf(row.r2Key);
    const prefixes = [baseKey, ...ROTATION_STATES.map((deg) => versionedKey(baseKey, deg))];
    const deletions = prefixes.flatMap((prefix) =>
      VARIANT_WIDTHS.map((w) => deleteObject(R2_BUCKET, `${prefix}/${w}.webp`).catch(() => {})),
    );
    deletions.push(
      deleteObject(
        R2_ORIGINALS_BUCKET,
        `${baseKey}/original.${extensionFor(row.mimeType ?? "image/jpeg")}`,
      ).catch(() => {}),
    );
    await Promise.all(deletions);
  }

  await db.delete(media).where(inArray(media.id, mediaIds));
  revalidateMediaEverywhere();
}

// ── 9. 圖片詳細資料（後台圖庫側邊面板，一次存全部）────────────────────
// 2026-10-22 後台改版：圖庫點開單張圖的面板裡，類型／系列／替代文字／焦點是同一個表單、
// 一個儲存鈕（業主選了手動儲存＋未存提醒），不是每改一欄就各自打一支 API。

const DetailsSchema = z.object({
  mediaId: z.string().cuid2(),
  kind: KIND_ENUM,
  collectionId: z.string().cuid2().nullable(),
  altEn: z.string().max(300),
  altZh: z.string().max(300),
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
});

export async function updateMediaDetails(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth();
  const { success } = await adminWriteRateLimit.limit(session.user.id);
  if (!success) return { ok: false, error: "操作太頻繁，請稍後再試。" };
  const parsed = DetailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "輸入格式錯誤" };
  const { mediaId, kind, collectionId, altEn, altZh, focalX, focalY } = parsed.data;

  const [current] = await db.select({ collectionId: media.collectionId }).from(media).where(eq(media.id, mediaId)).limit(1);
  if (!current) return { ok: false, error: "找不到這張圖片（可能已被刪除）" };

  await db
    .update(media)
    .set({
      kind,
      collectionId,
      altEn: altEn.trim() || null,
      altZh: altZh.trim() || null,
      focalX,
      focalY,
      ...(current.collectionId === collectionId ? {} : RESET_GALLERY_STATE),
    })
    .where(eq(media.id, mediaId));

  revalidateMediaEverywhere();
  return { ok: true };
}
