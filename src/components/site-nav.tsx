"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * 全站極簡導航——UI/UX 稽核（2026-09-16）抓到：全站真的沒有任何導航
 * （沒有 `<nav>`、頁尾只有 email/IG、系列頁之間也沒有上一個/下一個）。
 * 固定在左上角，跟右上角的 `LangSwitchButton` 對稱、視覺重量一致（同樣
 * 的 pill 樣式、同樣的 UI/Meta 字級），不是另外設計一套更重的導覽列，
 * 符合 SPEC §5.2「UI 元素極小極輕」的既定語言。
 *
 * `variant` 決定顯示哪些連結：
 * - `home`：WORK（錨點捲動到首頁自己的系列列表區塊）、BIO（錨點捲動到
 *   首頁自己的簡短簡介區塊）、ABOUT（真的導去 `/about` 完整關於頁）——
 *   刻意用不同字樣區分「捲動到本頁區塊」跟「換頁」，不要讓兩種完全不同
 *   的行為共用同一個「ABOUT」字樣，使用者會分不清楚點下去是留在原地
 *   還是換頁。
 * - `work`：INDEX（回首頁）、ABOUT（去關於頁）
 * - `about`：INDEX（回首頁）——已經在關於頁，不需要再放一次 ABOUT
 */
// `inline-block py-2.5` 撐開每個連結自己的觸控熱區——UI/UX 稽核
// （2026-09-16）修完 `LangSwitchButton` 的觸控範圍後複查這裡，發現
// `SiteNav` 的三個文字連結原本只有文字本身的 15px 行高可點，同一個問題
// 換了個地方又出現一次。`gap-4` 維持連結之間的視覺間距不變，熱區的
// padding 各自獨立，不會因為變胖而互相重疊。
const NAV_LINK_CLASS = "inline-flex min-h-11 items-center px-1 opacity-80 transition-opacity hover:opacity-100";

/**
 * 手機（< lg）往下捲時把固定在畫面上的導航與切換鈕收起來、往上捲或回到頂端
 * 再出現——它們是 `position: fixed`，不收的話會一直蓋住標題與作品（手機截圖
 * 實測：標題被 DARK 按鈕蓋住一個字、導航壓在圖上）。用 `<html data-chrome-hidden>`
 * 這個全域旗標 + `globals.css` 的 `[data-chrome]` 規則，所以其他固定元件（右上角
 * 的語言/主題鈕）只要加 `data-chrome` 就一起收。鍵盤 Tab 進到被收起的元件時
 * 會立刻顯示回來，避免焦點跑到看不見的地方。桌機不受影響（CSS 只在 max-width:1023px）。
 */
function useAutoHideChrome() {
  useEffect(() => {
    const root = document.documentElement;
    let lastY = window.scrollY;
    const set = (hidden: boolean) => {
      root.dataset.chromeHidden = hidden ? "true" : "false";
    };
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (y < 80) set(false);
      else if (delta > 8) set(true);
      else if (delta < -8) set(false);
      if (Math.abs(delta) > 8) lastY = y;
    };
    const onFocusIn = (e: FocusEvent) => {
      if ((e.target as HTMLElement | null)?.closest("[data-chrome]")) set(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocusIn);
      delete root.dataset.chromeHidden;
    };
  }, []);
}

const NAV_LABELS = {
  en: { home: "Home", work: "Work", bio: "Bio", about: "About" },
  zh: { home: "首頁", work: "作品", bio: "簡介", about: "關於" },
} as const;

/**
 * 第一次來的人要一眼看懂每個連結會去哪（2026-09-22 引導改版）：
 * - 標籤跟著目前語言（原本永遠是英文大寫，中文使用者要猜）；「INDEX」這種
 *   設計圈的行話改成大家都懂的「Home / 首頁」。
 * - 系列頁與關於頁多一個「Work / 作品」（回到首頁的系列列表 `/#series`）——
 *   看完一個系列想看別的系列，原本只能回首頁再自己往下找。
 * - `hasBio`：簡介還沒填時首頁沒有 `#bio` 區塊，「Bio」連結是點了沒反應的死
 *   連結（審計實測抓到），沒有簡介就不顯示。
 */
export function SiteNav({
  variant,
  lang = "en",
  hasBio = true,
}: {
  variant: "home" | "work" | "about";
  lang?: "en" | "zh";
  hasBio?: boolean;
}) {
  useAutoHideChrome();
  const t = NAV_LABELS[lang];
  return (
    <nav
      aria-label="Site"
      data-chrome
      className="fixed top-4 left-4 z-50 flex items-center gap-4 rounded border border-white/30 bg-black/50 px-3 py-0.5 text-[10px] tracking-[0.1em] text-white uppercase"
    >
      {variant === "home" ? (
        <>
          <a href="#series" className={NAV_LINK_CLASS}>
            {t.work}
          </a>
          {hasBio && (
            <a href="#bio" className={NAV_LINK_CLASS}>
              {t.bio}
            </a>
          )}
          <Link href="/about" className={NAV_LINK_CLASS}>
            {t.about}
          </Link>
        </>
      ) : (
        <>
          <Link href="/" className={NAV_LINK_CLASS}>
            {t.home}
          </Link>
          <Link href="/#series" className={NAV_LINK_CLASS}>
            {t.work}
          </Link>
          {variant === "work" && (
            <Link href="/about" className={NAV_LINK_CLASS}>
              {t.about}
            </Link>
          )}
        </>
      )}
    </nav>
  );
}
