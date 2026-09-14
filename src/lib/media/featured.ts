import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { collections, media } from "@/lib/db/schema";

/**
 * 首頁輪播的圖片池。資料模型：`media.featuredOrder`（見 schema.ts 註解）
 * ——null 代表不是精選照，非 null 是它在自己系列精選清單裡的順序。
 *
 * Fallback 邏輯（依系列各自判斷，不是全域一次判斷）：
 * 每個 `visibility === 'public'` 的系列，先看它自己有沒有任何一張精選照
 * （`featuredOrder` 不是 null）；有的話依 `featuredOrder` 取用；沒有的話
 * 退回暫定邏輯——該系列依 `media.sortOrder` 最前面的 3 張。草稿系列的圖
 * 完全不會進到這個池子裡（跟系列列表用同一條 SPEC §12.6 查詢層過濾原則，
 * 不是這批業主明講的規則，是延伸既有原則的判斷，見 HANDOFF.md）。
 */

export interface CarouselImage {
  id: string;
  r2Key: string;
  altEn: string | null;
}

const FALLBACK_COUNT = 3;

export async function getHomeCarouselImages(): Promise<CarouselImage[]> {
  const publicCollections = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.visibility, "public"))
    .orderBy(asc(collections.sortOrder));

  const pool: CarouselImage[] = [];

  for (const col of publicCollections) {
    const featured = await db
      .select({ id: media.id, r2Key: media.r2Key, altEn: media.altEn })
      .from(media)
      .where(and(eq(media.collectionId, col.id), isNotNull(media.featuredOrder)))
      .orderBy(asc(media.featuredOrder));

    if (featured.length > 0) {
      pool.push(...featured);
      continue;
    }

    const fallback = await db
      .select({ id: media.id, r2Key: media.r2Key, altEn: media.altEn })
      .from(media)
      .where(eq(media.collectionId, col.id))
      .orderBy(asc(media.sortOrder))
      .limit(FALLBACK_COUNT);
    pool.push(...fallback);
  }

  return pool;
}
