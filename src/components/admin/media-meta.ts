/** 後台共用的圖片分類標籤與型別（原本各頁面直接顯示 `final`/`detail` 這種英文代碼）。 */

export const MEDIA_KINDS = ["final", "detail", "sketch", "poster", "process", "misc"] as const;
export type AdminMediaKind = (typeof MEDIA_KINDS)[number];

export const KIND_LABEL_ZH: Record<AdminMediaKind, string> = {
  final: "成品",
  detail: "細節",
  sketch: "手繪稿",
  poster: "海報",
  process: "情境",
  misc: "其他",
};

/** 圖片選擇器需要的最小欄位（不選整列，只帶畫面會用到的）。 */
export interface PickerMedia {
  id: string;
  r2Key: string;
  filename: string | null;
  kind: AdminMediaKind;
  collectionId: string | null;
  altEn: string | null;
  altZh: string | null;
}

export interface PickerCollection {
  id: string;
  label: string;
}
