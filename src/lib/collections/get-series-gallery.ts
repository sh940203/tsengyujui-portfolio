import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { sortGallery } from "./gallery-order";
import type { GalleryStyle, MediaKind } from "./gallery-style";

export interface GalleryItem {
  id: string;
  r2Key: string;
  kind: MediaKind;
  /** 旋轉套用後的寬 ÷ 高。 */
  aspect: number;
  altEn: string | null;
  altZh: string | null;
}

/**
 * 系列內頁右欄要展示的「這個系列全部作品」——直接讀 `media` 表裡
 * `collectionId` 等於這個系列的所有圖，不是區塊編輯器引用到的那幾張
 * （使用者反映系列頁「圖片不齊全」）。
 *
 * 呼叫端已經先過了 `getPublishedCollection()` 的 visibility/發布判斷才會
 * 拿到系列 id，所以這裡不用再判斷（草稿系列根本走不到這裡）。只選
 * 需要的欄位，不選整列（沿用 SEO 批次「不要 select 整列」的原則）。
 *
 * 寬高比：`media.width/height` 存的**已經是旋轉後**（轉正後）的尺寸——
 * `generateAndUploadVariants` 回傳的就是轉正後的寬高，後台 `rotateMedia`
 * 旋轉時也是把這組值寫回資料庫（淨土手繪稿存 2482×3510、`rotation: 90`，
 * 實際變體檔是 800×1131 直式）。所以這裡**不能**再依 `rotation` 對調寬高
 * （上一版多對調了一次，手繪稿被放進橫式的框再被 `cover` 裁掉，用真實變體
 * 檔量到才發現）。沒有寬高資料的退回 2:3（成品照的常見比例）。
 *
 * 2026-10-22：業主可以在後台系列編輯器隱藏個別作品（`galleryHidden`，在查詢層就
 * 濾掉，不是前端藏起來）與拖曳自訂順序（`galleryOrder`）。排序規則抽到
 * `gallery-order.ts`，後台編輯器用同一支，所以後台看到的順序就是前台的順序。
 */
export async function getSeriesGallery(collectionId: string, style: GalleryStyle): Promise<GalleryItem[]> {
  const rows = await db
    .select({
      id: media.id,
      r2Key: media.r2Key,
      kind: media.kind,
      width: media.width,
      height: media.height,
      altEn: media.altEn,
      altZh: media.altZh,
      sortOrder: media.sortOrder,
      galleryOrder: media.galleryOrder,
    })
    .from(media)
    .where(and(eq(media.collectionId, collectionId), eq(media.galleryHidden, false)))
    .orderBy(asc(media.sortOrder));

  return sortGallery(rows, style).map((row) => {
    const w = row.width;
    const h = row.height;
    return {
      id: row.id,
      r2Key: row.r2Key,
      kind: row.kind,
      aspect: w && h ? w / h : 2 / 3,
      altEn: row.altEn,
      altZh: row.altZh,
    } satisfies GalleryItem;
  });
}
