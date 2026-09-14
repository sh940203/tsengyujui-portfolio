import type { RenderBlock, RenderMediaOption, RenderTheme } from "@/components/blocks/render/types";

/**
 * Block Editor 即時預覽（SPEC.md §7.4 項目 5）的 postMessage 訊息格式。
 * admin 頁面（父層）與 /admin/collections/[id]/preview（iframe）同源，
 * 但仍明確帶 targetOrigin 送出、接收端也檢查 event.origin，不用 "*"。
 *
 * `Preview*` 這幾個型別現在只是共用渲染元件（`components/blocks/render/
 * types.ts`）的型別別名，保留這個命名是因為這個檔案本身談的就是「admin
 * 預覽用的 postMessage 協定」，這個語境下 Preview 前綴仍然貼切；但形狀的
 * 定義來源已經搬到 render/types.ts，避免未來 `/work/[slug]` 前台也要
 * import 一個看起來是 admin 專用的模組。
 */
export type PreviewTheme = RenderTheme;
export type PreviewMediaOption = RenderMediaOption;
export type PreviewBlock = RenderBlock;

export const PREVIEW_UPDATE_SOURCE = "portfolio-admin-preview" as const;
export const PREVIEW_READY_SOURCE = "portfolio-preview-viewer" as const;

/** 父層 → iframe：目前（可能尚未存檔）的整頁內容。 */
export interface PreviewUpdateMessage {
  source: typeof PREVIEW_UPDATE_SOURCE;
  theme: PreviewTheme;
  mediaOptions: PreviewMediaOption[];
  blocks: PreviewBlock[];
}

/** iframe → 父層：預覽頁的訊息監聽已掛載，可以送第一份資料了。 */
export interface PreviewReadyMessage {
  source: typeof PREVIEW_READY_SOURCE;
}
