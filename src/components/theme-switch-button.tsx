"use client";

import { SWITCH_BUTTON_BASE_CLASS } from "@/components/lang-switch-button";

/**
 * 首頁/關於頁的「介面」淺色/深色切換（2026-09-16 新增）——注意這跟系列頁
 * 的 `theme`（dark/light/void，設計師依作品內容決定，見 SPEC §4.3）是
 * 兩件不同的事：這裡是「使用者自己選要用什麼模式看網站介面」，只影響
 * 首頁/關於頁這種固定用 SPEC §5.1 `--ui-black`/`--ui-white` 的頁面，不
 * 影響系列頁——系列頁的底色是作品的一部分，不該被使用者偏好覆蓋。
 *
 * 跟 `LangSwitchButton` 用同一顆按鈕的視覺基底（`SWITCH_BUTTON_BASE_CLASS`）疊成
 * 同一叢。2026-09-22 引導改版：原本顯示文字「DARK」/「LIGHT」（目前狀態），第一
 * 次來的人分不出是「現在是深色」還是「按了變深色」。改成圖示，顯示「按下去會變成
 * 的樣子」（深色模式顯示太陽＝按了變亮、淺色模式顯示月亮），這是最普遍的慣例，
 * 加上 `title` 提示與 `aria-label`。
 */
export function ThemeSwitchButton({
  uiTheme,
  onToggle,
}: {
  uiTheme: "dark" | "light";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={uiTheme === "dark" ? "Switch to light mode / 切換為淺色" : "Switch to dark mode / 切換為深色"}
      title={uiTheme === "dark" ? "切換為淺色 / Light mode" : "切換為深色 / Dark mode"}
      className={SWITCH_BUTTON_BASE_CLASS}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {uiTheme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
    </button>
  );
}
