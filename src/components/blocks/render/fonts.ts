import { Inter, Inter_Tight, Noto_Sans_TC } from "next/font/google";

/**
 * SPEC.md §5.2 —— 全站僅用無襯線 grotesque：
 * Display/標題用 Inter Tight（Neue Haas Grotesk Display 的開源替代，
 * weight 500–600）；UI/內文用 Inter（weight 300–400）；中文一律
 * Noto Sans TC（weight 300–500）。
 *
 * 刻意只在這批共用渲染元件（`block-render.tsx`）的最外層套用這幾個
 * CSS 變數，不動 `src/app/layout.tsx` 的全站字體——admin 後台自己的
 * 介面（表單、按鈕、圖庫）不屬於 SPEC §5 規範的對象，不應該被這批字體
 * 覆蓋。
 */

export const displayFont = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
  display: "swap",
});

export const uiFont = Inter({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-ui",
  display: "swap",
});

// Noto Sans TC 在 next/font/google 的 metadata 裡沒有中文專屬的 subset
// 選項（只有 cyrillic/latin/latin-ext/vietnamese），這是 Google Fonts CJK
// 字體在 next/font 底下的既知限制——但實際渲染中文字所需的 unicode-range
// 分片是由 Google 字體服務本身依請求到的字元動態切出，不受這裡的
// `subsets` 參數影響，`subsets: ["latin"]` 只是滿足 next/font 的必填參數。
// 已經在瀏覽器實測確認中文字確實套用了 Noto Sans TC（見 HANDOFF.md）。
export const zhFont = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-zh",
  display: "swap",
});
