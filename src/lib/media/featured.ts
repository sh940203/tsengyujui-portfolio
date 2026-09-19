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
 * 退回暫定邏輯——該系列依 `media.sortOrder` 最前面的 `FALLBACK_COUNT`
 * 張（2026-09-19 從 3 調成 4——湊對是兩兩一組，奇數張最後一張一定會被
 * 丟棄浪費掉，4 剛好湊成 2 對，沒有設計師動手選過精選照的系列也能有
 * 一點輪替變化，不會永遠只有同一對圖）。草稿系列的圖完全不會進到這個
 * 池子裡（跟系列列表用同一條 SPEC §12.6 查詢層過濾原則，不是這批業主
 * 明講的規則，是延伸既有原則的判斷，見 HANDOFF.md）。
 *
 * 2026-09-18：首頁 Hero 改成左右兩欄同時輪播（業主指定參考
 * aoiofficial.com），且業主明確要求「左右的照片要是同系列的」——原本
 * `getHomeCarouselImages()` 回傳的是攤平的單一圖片池（給一顆會淡入淡出
 * 換圖的單欄輪播用），沒有「兩張一組」的概念，改用 `getHomeCarouselPairs()`。
 *
 * 2026-09-19 更新：業主指示「精選照要能選多張」——原本只取每個系列精選
 * 清單的第 1、2 張湊一對，第 3 張以後完全沒用到，選再多也是白選。改成
 * **一個系列可以湊出多對**：精選清單依 `featuredOrder` 兩兩一組，
 * 第 1、2 張是第一對的左／右，第 3、4 張是第二對，以此類推——這樣「選
 * 多張」才有意義（多選幾張＝這個系列在輪播裡出現更多不同的組合，不是
 * 選了也沒用）。最後湊不成一對的單張（例如選了 5 張，第 5 張落單）直接
 * 丟棄，不會亂配對到下一個系列的圖——「同系列配對」這條規則任何情況都
 * 不能破。`FeaturedPhotosForm`（後台表單）同步顯示「第幾對的左/右」，
 * 不是只顯示一串縮圖靠使用者自己數奇偶數。
 */

export interface CarouselImage {
  id: string;
  r2Key: string;
  altEn: string | null;
}

export interface CarouselPair {
  left: CarouselImage;
  right: CarouselImage;
}

const FALLBACK_COUNT = 4;

async function getCollectionCarouselPool(collectionId: string): Promise<CarouselImage[]> {
  const featured = await db
    .select({ id: media.id, r2Key: media.r2Key, altEn: media.altEn })
    .from(media)
    .where(and(eq(media.collectionId, collectionId), isNotNull(media.featuredOrder)))
    .orderBy(asc(media.featuredOrder));

  if (featured.length > 0) return featured;

  return db
    .select({ id: media.id, r2Key: media.r2Key, altEn: media.altEn })
    .from(media)
    .where(eq(media.collectionId, collectionId))
    .orderBy(asc(media.sortOrder))
    .limit(FALLBACK_COUNT);
}

export async function getHomeCarouselPairs(): Promise<CarouselPair[]> {
  const publicCollections = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.visibility, "public"))
    .orderBy(asc(collections.sortOrder));

  const pairs: CarouselPair[] = [];

  for (const col of publicCollections) {
    const pool = await getCollectionCarouselPool(col.id);
    // 依序兩兩一組：0&1 是第一對、2&3 是第二對……落單的最後一張（奇數張
    // 時）直接丟棄，不跟下一個系列的圖湊對——「同系列配對」是硬規則。
    for (let i = 0; i + 1 < pool.length; i += 2) {
      pairs.push({ left: pool[i], right: pool[i + 1] });
    }
  }

  return pairs;
}
