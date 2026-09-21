"use client";

/**
 * 全站唯一一顆 EN/ZH 切換鈕的共用元件——原本首頁/關於頁
 * （`lang-page-wrapper.tsx`）、系列內頁（`work-page-client.tsx`）、admin
 * 即時預覽 iframe（`preview-client.tsx`）三份幾乎一模一樣的 button 各自
 * 複製貼上一份，UI/UX 稽核（2026-09-16）時發現這樣不只是重複——之後要
 * 一起調整（例如這次要修的觸控範圍）很容易漏改其中一份。
 *
 * 觸控範圍：原本 `px-2 py-1 text-[10px]`（實測只有 32×25px）在手機上不好
 * 按，且是全站使用頻率最高的互動元件。改成 `min-h-11 min-w-11`
 * （44×44px，業界慣用的舒適觸控尺寸下限），視覺上維持 SPEC §5.2「UI 元素
 * 極小極輕」的意圖——用 padding 撐開熱區，文字本身不放大。
 *
 * `compact`：admin 預覽 iframe 是滑鼠操作、畫面本身就窄（見
 * `preview-client.tsx`），不適用觸控尺寸標準，維持原本較小的
 * `top-2 right-2` + 32×25px，不套用 44×44。
 *
 * `unpositioned`：首頁/關於頁（`lang-page-wrapper.tsx`）現在要跟新的
 * `ThemeSwitchButton` 疊成同一叢右上角按鈕，需要外層容器統一定位，這裡
 * 就不要自己再帶一次 `fixed top-4 right-4`（兩個 `fixed` 疊在一起，位置
 * 會被最後渲染的那個蓋掉，不會自然排列成一疊）。
 */
export const SWITCH_BUTTON_BASE_CLASS =
  "flex min-h-11 min-w-11 items-center justify-center rounded border border-white/30 bg-black/50 text-[10px] text-white";

export function LangSwitchButton({
  lang,
  onToggle,
  compact = false,
  unpositioned = false,
}: {
  lang: "en" | "zh";
  onToggle: () => void;
  compact?: boolean;
  unpositioned?: boolean;
}) {
  return (
    <button
      type="button"
      data-chrome={!compact && !unpositioned ? "" : undefined}
      onClick={onToggle}
      aria-label={lang === "en" ? "Switch to Chinese / 切換為中文" : "Switch to English / 切換為英文"}
      className={
        compact
          ? "fixed top-2 right-2 z-50 rounded border border-white/30 bg-black/50 px-2 py-1 text-[10px] text-white"
          : `${unpositioned ? "" : "fixed top-4 right-4 z-50 "}${SWITCH_BUTTON_BASE_CLASS} gap-1 px-2.5`
      }
    >
      {compact ? (
        lang.toUpperCase()
      ) : (
        // 兩種語言都顯示、目前的那個粗體（SPEC §6.3 原本就是「EN / ZH」）：原本只顯示
        // 目前語言（「EN」），第一次來的人不知道按了會變什麼、甚至不知道有中文。
        <>
          <span className={lang === "en" ? "font-semibold" : "opacity-50"}>EN</span>
          <span aria-hidden="true" className="opacity-30">
            /
          </span>
          <span className={lang === "zh" ? "font-semibold" : "opacity-50"}>中</span>
        </>
      )}
    </button>
  );
}
