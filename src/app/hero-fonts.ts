import { Noto_Sans_TC, Syne } from "next/font/google";

/**
 * 首頁 Hero 姓名/職稱的文字字體——只套在 `hero.tsx` 上，不動
 * `src/components/blocks/render/fonts.ts` 的全站字體（SPEC §5.2）。
 *
 * 姓名之後會由 `src/lib/brand/name-logotype.ts` 的專屬字樣取代；這裡的字體是「字樣還沒做」
 * 時的退回顯示，以及職稱那一行（`Fashion Designer`）本來就一直會用到的字體。
 *
 * 英文：Syne（寬字距、個性強的無襯線，藝術/前衛時裝識別常見，仍屬 grotesque
 * 陣營，沒有違反 SPEC「禁止襯線」）。
 * 中文：Noto Sans TC——業主看過楷體（LXGW WenKai TC）覺得不好看，沒有從其他
 * 候選（Noto Black、LXGW Marker Gothic、Chocolate Classical Sans）中選定，改走
 * 專屬字樣，這裡先維持 SPEC 原本的中文字體。
 *
 * 中文字體沿用 `fonts.ts` 的做法：`subsets: ["latin"]` 只是滿足 next/font 的
 * 必填參數，實際中文字所需的 unicode-range 分片由字體服務依需求切出。
 */
export const heroEnFont = Syne({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-hero-en",
  display: "swap",
});

export const heroZhFont = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-hero-zh",
  display: "swap",
});
