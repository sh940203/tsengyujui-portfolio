"use server";

import { eq } from "drizzle-orm";
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
    .regex(/^[a-z0-9-]+$/, "網址代稱只能是小寫英數與連字號"),
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

// ── 系列編輯器：一次存全部（2026-10-22 後台改版）──────────────────────
// 系列編輯頁改成「整頁一個儲存鈕」（業主選了手動儲存＋未存提醒）：基本資料、敘述、
// 外觀、作品長廊（順序／隱藏）、首頁精選照一起送出。全部寫入包在同一個 libsql batch
// 裡（同一筆交易），不會出現「基本資料存了、長廊順序沒存」這種半套狀態。

const SaveCollectionEditorSchema = z.object({
  collection: UpdateCollectionSchema,
  gallery: z.object({
    /** 這個系列全部圖片的順序（含隱藏的）。 */
    orderedIds: z.array(z.string().cuid2()).max(500),
    /** false＝沒有自訂順序，前台依類型自動排序（`galleryOrder` 全部清成 null）。 */
    custom: z.boolean(),
    hiddenIds: z.array(z.string().cuid2()).max(500),
  }),
  featuredIds: z.array(z.string().cuid2()).max(30),
});

export async function saveCollectionEditor(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth();
  const { success } = await adminWriteRateLimit.limit(session.user.id);
  if (!success) return { ok: false, error: "操作太頻繁，請稍後再試。" };

  const parsed = SaveCollectionEditorSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "輸入格式錯誤" };
  }
  const { collection, gallery, featuredIds } = parsed.data;
  const { id, ...values } = collection;

  const [existing] = await db
    .select({ slug: collections.slug })
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);
  if (!existing) return { ok: false, error: "找不到這個系列" };

  // 防呆：只處理真的屬於這個系列的圖（不讓竄改過的請求動到別的系列）
  const ownedRows = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.collectionId, id));
  const owned = new Set(ownedRows.map((r) => r.id));
  const hidden = new Set(gallery.hiddenIds.filter((mid) => owned.has(mid)));
  const ordered = gallery.orderedIds.filter((mid) => owned.has(mid));
  // 順序清單漏掉的圖（例如編輯期間另一個分頁剛上傳的）排在最後，不會被弄丟
  for (const mid of owned) if (!ordered.includes(mid)) ordered.push(mid);
  // 隱藏的圖不能當首頁精選（前台 featured.ts 也會擋，這裡是第一道）
  const featured = featuredIds.filter((mid) => owned.has(mid) && !hidden.has(mid));
  const featuredIndex = new Map(featured.map((mid, i) => [mid, i]));

  try {
    await db.batch([
      db
        .update(collections)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(collections.id, id)),
      ...ordered.map((mid, index) =>
        db
          .update(media)
          .set({
            galleryOrder: gallery.custom ? index : null,
            galleryHidden: hidden.has(mid),
            featuredOrder: featuredIndex.get(mid) ?? null,
          })
          .where(eq(media.id, mid)),
      ),
    ]);
  } catch (err) {
    const cause = err instanceof Error ? err.cause : undefined;
    const causeMessage = cause instanceof Error ? cause.message : String(cause ?? "");
    const message = err instanceof Error ? err.message : "";
    if (causeMessage.includes("UNIQUE") || message.includes("UNIQUE")) {
      return { ok: false, error: `網址代稱「${values.slug}」已經被其他系列使用` };
    }
    return { ok: false, error: "儲存失敗，請稍後再試。" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/collections");
  revalidatePath(`/admin/collections/${id}`);
  revalidatePath("/");
  revalidatePath(`/work/${values.slug}`);
  if (existing.slug !== values.slug) revalidatePath(`/work/${existing.slug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
  return { ok: true };
}
