import type { RenderTheme } from "@/components/blocks/render/types";

/**
 * 系列內頁右欄「作品長廊」的三種展示風格（2026-09-20）。共用同一套邏輯——
 * 左欄固定完整敘述、右欄捲動系列全部作品——但每個系列的節奏不一樣，見
 * `src/app/work/[slug]/series-gallery.tsx`：
 *
 * - `flash`（Cumedy Night）：緊繃擁擠的拼貼＋閃燈式進場
 * - `still`（淨土）：一屏一件、緩慢浮現、敘述隨捲動逐行亮起
 * - `venom`（X-venom）：越往下越模糊壓迫，游標周圍一圈透鏡看得清楚
 *
 * 風格直接由系列的 `theme`（SPEC §4.3，設計師本來就依作品體感選的
 * dark/light/void）決定，不另外加資料庫欄位：三個系列的體感跟主題本來
 * 就是一對一（SPEC §5.4）。之後新增系列時會依主題自動得到對應風格；
 * 如果某個系列的體感跟主題不一致，再改成資料庫欄位。
 */
export type GalleryStyle = "flash" | "still" | "venom";

export function galleryStyleFor(theme: RenderTheme): GalleryStyle {
  if (theme === "light") return "still";
  if (theme === "void") return "venom";
  return "flash";
}

export type MediaKind = "final" | "detail" | "sketch" | "poster" | "process" | "misc";

/**
 * 每種風格的作品排序（同 kind 內再依 `media.sortOrder`）。`misc` 放最後：
 * 匯入時沒歸類的檔案，不該搶在正式作品前面。
 * - flash：成品 → 自製海報（CUM.N 包裝設計）→ 手繪稿放最後當「設計牆」
 * - still：成品 → 細節 → 情境 → 手繪稿
 * - venom：SPEC §10.1 X-venom 開場是設計師自製海報，所以海報最前
 */
export const KIND_ORDER: Record<GalleryStyle, MediaKind[]> = {
  flash: ["final", "poster", "sketch", "detail", "process", "misc"],
  still: ["final", "detail", "process", "sketch", "poster", "misc"],
  venom: ["poster", "final", "detail", "process", "sketch", "misc"],
};

export const KIND_LABEL: Record<MediaKind, { en: string; zh: string }> = {
  final: { en: "Look", zh: "成品" },
  detail: { en: "Detail", zh: "細節" },
  sketch: { en: "Sketch", zh: "手繪稿" },
  poster: { en: "Poster", zh: "海報" },
  process: { en: "Process", zh: "情境" },
  misc: { en: "Work", zh: "作品" },
};
