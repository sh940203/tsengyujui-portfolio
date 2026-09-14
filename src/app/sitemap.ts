import type { MetadataRoute } from "next";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { collections } from "@/lib/db/schema";
import { absoluteUrl } from "@/lib/seo";

/**
 * SPEC.md §8.2：只收 `visibility === 'public'` 的系列。刻意再加一條
 * `publishedSnapshot IS NOT NULL`——`/work/[slug]` 本身的存取邏輯是
 * 「public 但沒發布過一樣 404」（見 `getPublishedCollection`），sitemap
 * 只看 visibility 會收錄到實際上會 404 的頁面，兩邊判斷標準要一致。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicCollections = await db
    .select({ slug: collections.slug, publishedAt: collections.publishedAt, updatedAt: collections.updatedAt })
    .from(collections)
    .where(and(eq(collections.visibility, "public"), isNotNull(collections.publishedSnapshot)))
    .orderBy(asc(collections.sortOrder));

  return [
    { url: absoluteUrl("/"), changeFrequency: "monthly", priority: 1 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
    ...publicCollections.map((c) => ({
      url: absoluteUrl(`/work/${c.slug}`),
      lastModified: c.publishedAt ?? c.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
