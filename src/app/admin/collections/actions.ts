"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";
import { collections, media } from "@/lib/db/schema";
import { adminWriteRateLimit } from "@/lib/rate-limit";

// 對應 SPEC.md §12.5 的 UpdateCollectionSchema 範例（slug 白名單、titleEn 長度上限）
const UpdateCollectionSchema = z.object({
  id: z.string().cuid2(),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "slug 只能是小寫英數與連字號"),
  titleEn: z.string().min(1).max(120),
  titleZh: z.string().max(120).nullable(),
  year: z.string().max(20).nullable(),
  category: z.string().max(60).nullable(),
  pieceCount: z.number().int().nonnegative().nullable(),
  statementEn: z.string().max(4000).nullable(),
  statementZh: z.string().max(4000).nullable(),
  theme: z.enum(["dark", "light", "void"]),
  visibility: z.enum(["public", "unlisted", "draft"]),
  requiresConsent: z.boolean(),
  consentNoteEn: z.string().max(1000).nullable(),
  consentNoteZh: z.string().max(1000).nullable(),
  coverImageId: z.string().cuid2().nullable(),
  ogImageId: z.string().cuid2().nullable(),
  titleImageId: z.string().cuid2().nullable(),
});

export type UpdateCollectionInput = z.infer<typeof UpdateCollectionSchema>;

export async function updateCollection(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth();
  const { success } = await adminWriteRateLimit.limit(session.user.id);
  if (!success) return { ok: false, error: "操作太頻繁，請稍後再試。" };

  const parsed = UpdateCollectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "輸入格式錯誤" };
  }
  const { id, ...values } = parsed.data;

  try {
    await db
      .update(collections)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(collections.id, id));
  } catch (err) {
    // drizzle 包了一層 "Failed query: ..."，真正的 SQLITE_CONSTRAINT 錯誤在
    // err.cause 裡（實測過：err.message 本身不含 "UNIQUE"，找錯地方會一路
    // fall back 到通用錯誤訊息，使用者永遠看不到真正原因）。
    const cause = err instanceof Error ? err.cause : undefined;
    const causeMessage = cause instanceof Error ? cause.message : String(cause ?? "");
    if (causeMessage.includes("UNIQUE")) {
      return { ok: false, error: `slug "${values.slug}" 已經被使用` };
    }
    return { ok: false, error: "儲存失敗，請稍後再試。" };
  }

  revalidatePath("/admin/collections");
  revalidatePath(`/admin/collections/${id}`);
  // `visibility`/`slug`/`statementEn` 等等都在這支表單裡改——公開前台
  // （首頁列表、sitemap、llms.txt、該系列自己的頁面）都要跟著重新驗證，
  // 不然 production 的靜態快取會在切換 public/draft 後繼續顯示舊狀態
  // 直到下次部署（見 `publishCollection` 同一批次的說明）。用改之後的
  // `values.slug`，不特別處理「改名」這種罕見情況下舊網址快取一起失效
  // ——舊網址本來下一輪自然重整就會跟著更新，不是這批要解決的問題。
  revalidatePath("/");
  revalidatePath(`/work/${values.slug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
  return { ok: true };
}

// ── 精選照（首頁輪播）─────────────────────────────────────────────
// 資料模型見 src/lib/db/schema.ts 的 media.featuredOrder 註解、讀取邏輯見
// src/lib/media/featured.ts。這裡只負責「業主在後台選了哪些、什麼順序」
// 寫回資料庫。

const SetFeaturedMediaSchema = z.object({
  collectionId: z.string().cuid2(),
  mediaIds: z.array(z.string().cuid2()).max(30),
});

export async function setFeaturedMedia(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth();
  const { success } = await adminWriteRateLimit.limit(session.user.id);
  if (!success) return { ok: false, error: "操作太頻繁，請稍後再試。" };

  const parsed = SetFeaturedMediaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "輸入格式錯誤" };
  }
  const { collectionId, mediaIds } = parsed.data;

  // 防呆：只接受真的屬於這個系列的 media id，不讓人透過這支 action
  // 把別的系列的照片標記成精選照（例如竄改過的請求）。
  const ownedRows = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.collectionId, collectionId), inArray(media.id, mediaIds)));
  const ownedIds = new Set(ownedRows.map((r) => r.id));
  const finalIds = mediaIds.filter((id) => ownedIds.has(id));

  // 先清空這個系列目前的精選照，再依新順序寫入——避免「移除了某張但
  // 沒清掉它的 featuredOrder」這種殘留狀態。
  await db.update(media).set({ featuredOrder: null }).where(eq(media.collectionId, collectionId));
  await Promise.all(
    finalIds.map((id, index) => db.update(media).set({ featuredOrder: index }).where(eq(media.id, id))),
  );

  revalidatePath(`/admin/collections/${collectionId}`);
  revalidatePath("/");
  return { ok: true };
}
