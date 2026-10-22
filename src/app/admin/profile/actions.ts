"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";
import { profile } from "@/lib/db/schema";
import { adminWriteRateLimit } from "@/lib/rate-limit";

// 所有欄位皆可為 null——SPEC.md §10.3 明列 bio / 聯絡方式 / IG / Behance
// 目前「尚待業主提供」，現階段合法留空，不能因為 zod 擋掉空值而存不進去。
// email 只在「有填」時才檢查格式，空值一律先在前端轉成 null 再送進來。
const UpdateProfileSchema = z.object({
  nameEn: z.string().max(120).nullable(),
  nameZh: z.string().max(120).nullable(),
  roleEn: z.string().max(120).nullable(),
  roleZh: z.string().max(120).nullable(),
  locationEn: z.string().max(120).nullable(),
  locationZh: z.string().max(120).nullable(),
  bioEn: z.string().max(4000).nullable(),
  bioZh: z.string().max(4000).nullable(),
  email: z.string().email().max(200).nullable(),
  instagram: z.string().max(200).nullable(),
  behance: z.string().max(200).nullable(),
  heroImageId: z.string().cuid2().nullable(),
  aboutImageId: z.string().cuid2().nullable(),
  seoTitle: z.string().max(200).nullable(),
  seoDescription: z.string().max(500).nullable(),
  defaultOgImageId: z.string().cuid2().nullable(),
});

export async function updateProfile(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth();
  const { success } = await adminWriteRateLimit.limit(session.user.id);
  if (!success) return { ok: false, error: "操作太頻繁，請稍後再試。" };

  const parsed = UpdateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "輸入格式錯誤" };
  }

  await db
    .update(profile)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(profile.id, "singleton"));

  revalidatePath("/admin/profile");
  revalidatePath("/admin"); // 總覽的「待補資料」
  // 首頁（姓名/bio/聯絡資訊）跟關於頁都直接讀這張表，不 revalidate 的話
  // 存檔後前台會有一段時間顯示舊資料（下次自然重新整理前）。
  revalidatePath("/");
  revalidatePath("/about");
  return { ok: true };
}
