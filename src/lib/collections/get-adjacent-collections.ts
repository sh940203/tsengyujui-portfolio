import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db/client";
import { collections } from "@/lib/db/schema";

export interface AdjacentCollectionLink {
  slug: string;
  titleEn: string;
  titleZh: string | null;
}

/**
 * SPEC.md §4.3「系列間導航：頁尾提供上一個系列/下一個系列」——一直沒做
 * （見 HANDOFF.md Phase 4 第三批「刻意沒做的部分」），UI/UX 稽核
 * （2026-09-16）抓到全站完全沒有這個導航後補上。
 *
 * 只依 `visibility === 'public'` 的順序算上一個/下一個，跟首頁系列列表
 * 用同一個過濾條件（`unlisted` 不算進這個序列——`unlisted` 語意是「不公開
 * 列出」，塞進 prev/next 導航等於變相列出它，跟首頁列表/sitemap 的既有
 * 決策一致）。只選這裡真的要用到的三個欄位，不要 select 整列（SEO 批次
 * 排查那次的教訓）。
 */
export const getAdjacentCollections = cache(
  async (
    currentSlug: string,
  ): Promise<{ prev: AdjacentCollectionLink | null; next: AdjacentCollectionLink | null }> => {
    const rows = await db
      .select({
        slug: collections.slug,
        titleEn: collections.titleEn,
        titleZh: collections.titleZh,
      })
      .from(collections)
      .where(eq(collections.visibility, "public"))
      .orderBy(asc(collections.sortOrder));

    const index = rows.findIndex((r) => r.slug === currentSlug);
    if (index === -1) return { prev: null, next: null };

    return {
      prev: index > 0 ? rows[index - 1] : null,
      next: index < rows.length - 1 ? rows[index + 1] : null,
    };
  },
);
