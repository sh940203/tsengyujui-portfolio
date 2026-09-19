import type { BlockType } from "@/lib/blocks/schemas";

/**
 * 這批型別的定義原本放在 `src/lib/blocks/preview-message.ts`（admin 專用的
 * postMessage 協定），現在挪到這裡——共用渲染元件的形狀不該定義在一個名字
 * 叫「preview-message」的檔案裡，那個檔案應該反過來 import 這裡的型別，
 * 因為未來 `/work/[slug]` 前台不會、也不該 import 一個看起來是 admin 專用
 * 的模組。`preview-message.ts` 目前用 type alias 保留原本的命名不動，避免
 * 動到 admin 那邊沒必要異動的程式碼。
 */

export type RenderTheme = "dark" | "light" | "void";

export interface RenderMediaOption {
  id: string;
  r2Key: string;
  filename: string | null;
  altEn: string | null;
  altZh: string | null;
}

export interface RenderBlock {
  id: string;
  type: BlockType;
  config: Record<string, unknown>;
}

/** SPEC.md §4.3 系列間導航（上一個/下一個系列）用的最小連結形狀。 */
export interface AdjacentCollectionLink {
  slug: string;
  titleEn: string;
  titleZh: string | null;
}
