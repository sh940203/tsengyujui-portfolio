import Link from "next/link";

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
const NAV_LINK_CLASS = "inline-block px-1 py-2.5 opacity-80 transition-opacity hover:opacity-100";

export function SiteNav({ variant }: { variant: "home" | "work" | "about" }) {
  return (
    <nav
      aria-label="Site"
      className="fixed top-4 left-4 z-50 flex items-center gap-4 rounded border border-white/30 bg-black/50 px-3 py-0.5 text-[10px] tracking-[0.1em] text-white uppercase"
    >
      {variant === "home" ? (
        <>
          <a href="#series" className={NAV_LINK_CLASS}>
            Work
          </a>
          <a href="#bio" className={NAV_LINK_CLASS}>
            Bio
          </a>
          <Link href="/about" className={NAV_LINK_CLASS}>
            About
          </Link>
        </>
      ) : (
        <>
          <Link href="/" className={NAV_LINK_CLASS}>
            Index
          </Link>
          {variant === "work" && (
            <Link href="/about" className={NAV_LINK_CLASS}>
              About
            </Link>
          )}
        </>
      )}
    </nav>
  );
}
