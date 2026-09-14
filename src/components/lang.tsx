import type { CSSProperties } from "react";
import { displayFont, uiFont, zhFont } from "./blocks/render/fonts";

/**
 * SPEC.md §6 語言系統的共用元件——原本定義在 `block-render.tsx` 裡，只
 * 給區塊內容用；現在首頁的姓名/bio/系列標題也需要同一套雙語機制，搬到
 * 這個中性位置，`block-render.tsx` 改成從這裡 import，避免站台層級的
 * 文字反過來依賴一個聽起來是「區塊渲染專用」的模組。
 *
 * 兩種語言永遠同時存在於 DOM，切換改變的是視覺層級，不是內容有無。
 * `.lang-en`/`.lang-zh` 兩個 class 本身不控制任何視覺樣式，樣式規則在
 * `globals.css`，依最外層容器的 `data-lang` 屬性決定哪一個是「主」
 * （`font-size:1em；opacity:1`）、哪一個是「輔」（`0.55em；0.55`）——
 * 純 CSS，切換零延遲，不需要重新渲染任何內容。字型依語言固定（英文
 * Inter/Inter Tight、中文 Noto Sans TC），跟目前是哪個語言在前無關。
 */

export type LangRole = "display" | "ui";

export function langFontClass(lang: "en" | "zh", role: LangRole) {
  if (lang === "zh") return "font-[family-name:var(--font-zh)]";
  return role === "display"
    ? "font-[family-name:var(--font-display)]"
    : "font-[family-name:var(--font-ui)]";
}

/** 掛在任何要用到 `Lang`/`langFontClass` 的根容器上，定義三個字型的 CSS 變數。 */
export const langFontVariables = `${displayFont.variable} ${uiFont.variable} ${zhFont.variable}`;

export function Lang({
  en,
  zh,
  role,
  className,
  style,
}: {
  en: string;
  zh: string;
  role: LangRole;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={className} style={style}>
      {en && (
        <span className={`lang-en ${langFontClass("en", role)}`} style={{ whiteSpace: "pre-line" }}>
          {en}
        </span>
      )}
      {zh && (
        <span className={`lang-zh ${langFontClass("zh", role)}`} style={{ whiteSpace: "pre-line" }}>
          {zh}
        </span>
      )}
    </span>
  );
}
