import { KIND_ORDER, type GalleryStyle, type MediaKind } from "./gallery-style";

/**
 * 系列「作品長廊」的排序規則——前台 `getSeriesGallery` 跟後台系列編輯器（拖曳排序、
 * 「恢復自動排序」）共用同一支，所以後台看到的順序永遠就是前台的順序。
 * 純函式、不碰資料庫，client component 也能 import。
 *
 * - 系列裡只要有任何一張圖有 `galleryOrder`（業主在後台存過自訂順序），就依
 *   `galleryOrder` 排；之後才新上傳、還沒有 `galleryOrder` 的圖排在最後（再依
 *   自動規則），不會插隊到業主排好的作品前面。
 * - 全部都是 null（沒自訂過）：依系列風格的類型順序（`KIND_ORDER`），同類型內
 *   依 `sortOrder`——就是 2026-09-20 以來前台一直在用的規則，沒有自訂過的系列
 *   外觀完全不變。
 */
export interface OrderableGalleryRow {
  kind: MediaKind;
  sortOrder: number;
  galleryOrder: number | null;
}

export function autoGalleryRank(style: GalleryStyle, kind: MediaKind): number {
  const order = KIND_ORDER[style];
  const i = order.indexOf(kind);
  return i === -1 ? order.length : i;
}

/** 依類型自動排序（忽略 `galleryOrder`）。給「恢復自動排序」用。 */
export function sortGalleryAuto<T extends OrderableGalleryRow>(rows: T[], style: GalleryStyle): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        autoGalleryRank(style, a.row.kind) - autoGalleryRank(style, b.row.kind) ||
        a.row.sortOrder - b.row.sortOrder ||
        a.index - b.index,
    )
    .map((entry) => entry.row);
}

export function hasCustomGalleryOrder(rows: OrderableGalleryRow[]): boolean {
  return rows.some((row) => row.galleryOrder !== null);
}

/** 前台實際使用的順序。 */
export function sortGallery<T extends OrderableGalleryRow>(rows: T[], style: GalleryStyle): T[] {
  if (!hasCustomGalleryOrder(rows)) return sortGalleryAuto(rows, style);
  const custom = rows
    .filter((row) => row.galleryOrder !== null)
    .sort((a, b) => (a.galleryOrder as number) - (b.galleryOrder as number));
  const rest = sortGalleryAuto(
    rows.filter((row) => row.galleryOrder === null),
    style,
  );
  return [...custom, ...rest];
}
