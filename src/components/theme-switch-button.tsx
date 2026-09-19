"use client";

import { SWITCH_BUTTON_BASE_CLASS } from "@/components/lang-switch-button";

/**
 * 首頁/關於頁的「介面」淺色/深色切換（2026-09-16 新增）——注意這跟系列頁
 * 的 `theme`（dark/light/void，設計師依作品內容決定，見 SPEC §4.3）是
 * 兩件不同的事：這裡是「使用者自己選要用什麼模式看網站介面」，只影響
 * 首頁/關於頁這種固定用 SPEC §5.1 `--ui-black`/`--ui-white` 的頁面，不
 * 影響系列頁——系列頁的底色是作品的一部分，不該被使用者偏好覆蓋。
 *
 * 跟 `LangSwitchButton` 用同一顆按鈕的視覺基底（`SWITCH_BUTTON_BASE_CLASS`）
 * 疊成同一叢，文字換成 DARK/LIGHT。跟 `LangSwitchButton` 同一種顯示邏輯
 * ——顯示「目前狀態」（目前是 dark 就顯示 DARK），不是顯示「按下去會變
 * 成什麼」，兩顆按鈕的互動慣例保持一致。
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
      className={SWITCH_BUTTON_BASE_CLASS}
    >
      {uiTheme.toUpperCase()}
    </button>
  );
}
