"use server";

import { createId } from "@paralleldrive/cuid2";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";
import { awards } from "@/lib/db/schema";
import { adminWriteRateLimit } from "@/lib/rate-limit";

/**
 * 比賽經歷：整頁一次存（2026-10-22 後台改版）。原本後台只能改證書圖跟「是否公開」，
 * 獎項本身（年份、名稱、成績）不能新增、修改、刪除或排序，只能請工程端直接改資料庫。
 * 現在新增／修改／刪除／排序都在同一個表單，一個儲存鈕，寫入包在同一個 batch（交易）裡。
 *
 * 英文名稱可以留空——沒有官方英譯時寧可留白，前台只顯示中文，不編造翻譯（見 schema 註解）。
 */

const AwardSchema = z
  .object({
    id: z.string().cuid2().nullable(), // null＝新增
    year: z.string().trim().min(1, "每個獎項都要填年份").max(20),
    titleZh: z.string().trim().max(200),
    titleEn: z.string().trim().max(200),
    resultZh: z.string().trim().max(120),
    resultEn: z.string().trim().max(120),
    imageId: z.string().cuid2().nullable(),
    showCertificate: z.boolean(),
  })
  .refine((a) => a.titleZh || a.titleEn, { message: "每個獎項至少要有中文或英文名稱" });

const SaveAwardsSchema = z.object({
  items: z.array(AwardSchema).max(100),
  deletedIds: z.array(z.string().cuid2()).max(100),
});

export async function saveAwards(
  input: unknown,
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const session = await requireAuth();
  const { success } = await adminWriteRateLimit.limit(session.user.id);
  if (!success) return { ok: false, error: "操作太頻繁，請稍後再試。" };

  const parsed = SaveAwardsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "輸入格式錯誤" };
  const { items, deletedIds } = parsed.data;

  const ids = items.map((a) => a.id ?? createId());
  const nullable = (v: string) => (v ? v : null);
  const statements = [
    ...(deletedIds.length ? [db.delete(awards).where(inArray(awards.id, deletedIds))] : []),
    ...items.map((a, index) => {
      const values = {
        year: a.year,
        titleZh: nullable(a.titleZh),
        titleEn: nullable(a.titleEn),
        resultZh: nullable(a.resultZh),
        resultEn: nullable(a.resultEn),
        imageId: a.imageId,
        // 沒有證書圖就不可能公開證書
        showCertificate: a.imageId ? a.showCertificate : false,
        sortOrder: index + 1,
      };
      return a.id
        ? db.update(awards).set(values).where(eq(awards.id, a.id))
        : db.insert(awards).values({ id: ids[index], ...values });
    }),
  ];
  if (statements.length === 0) return { ok: true, ids };
  try {
    await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
  } catch {
    return { ok: false, error: "儲存失敗，請稍後再試。" };
  }

  revalidatePath("/admin/awards");
  revalidatePath("/admin");
  revalidatePath("/admin/media");
  revalidatePath("/about"); // 獎項清單與證書
  revalidatePath("/"); // 首頁獲獎跑馬燈
  return { ok: true, ids };
}
