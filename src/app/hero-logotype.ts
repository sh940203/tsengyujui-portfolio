/**
 * 首頁 Hero 姓名的「專屬字樣」（手繪/自製的姓名 logotype），業主選擇的方向：
 * 姓名只有 `曾昱睿` / `Tseng Yu Jui`，不需要一整套字體，做一張字樣圖即可。
 *
 * 設了就顯示圖、沒設（`null`）就退回 `hero-fonts.ts` 的文字——中英各自獨立，
 * 可以只做中文、只做英文、或兩個都做。
 *
 * 放檔案的位置與規格：
 * - 放在 `public/brand/`，例如 `public/brand/name-zh.svg`、`name-en.svg`
 *   （手動放進專案，不走後台上傳——SVG 不適合走後台上傳流程，
 *   SPEC §12.4 的 MIME 白名單/XSS 風險）。
 * - **背景必須透明**（去背），首選單色 SVG；PNG 的話寬度至少 2400px。
 * - 顏色不限：程式會用 CSS filter 統一轉成白色（`mix-blend-mode: difference`
 *   需要白色才會有反相效果，黑色會整個消失）。
 * - `aspect` = 寬 ÷ 高（例如 SVG 的 viewBox 是 `0 0 900 300` 就填 3），用來
 *   在圖片載入前先預留正確的寬度，避免版面跳動。
 * - `heightEm` = 字樣高度，單位是姓名字級的倍數（1 = 跟一般文字同高）。
 *   用 em 而不是 px，語言切換時（主要語言 1em、次要 0.55em，globals.css）
 *   字樣會跟著一起縮放。
 */
export interface Logotype {
  src: string;
  aspect: number;
  heightEm: number;
}

export const HERO_NAME_LOGOTYPE: { en: Logotype | null; zh: Logotype | null } = {
  en: { src: "/brand/name-en.svg", aspect: 6.2, heightEm: 1.23 },
  zh: { src: "/brand/name-zh.svg", aspect: 2.691, heightEm: 2 },
};
