"use client";

import { useState } from "react";
import { langFontVariables } from "@/components/lang";
import { LangSwitchButton } from "@/components/lang-switch-button";
import { SiteNav } from "@/components/site-nav";
import { ThemeSwitchButton } from "@/components/theme-switch-button";

/**
 * 任何一個「整頁」層級需要 EN/ZH 切換鈕 + `data-lang` 的頁面共用這支——
 * 原本只有首頁需要，定義在 `home-page-client.tsx`；關於頁上線後變成
 * 第二個消費者，搬到這個中性位置（跟 `lang.tsx` 當初搬家理由一樣）。
 * 內容本身維持 Server Component、用 `children` 傳進來。
 *
 * `navVariant` 決定左上角 `SiteNav` 顯示哪組連結（見該檔案說明）——
 * 首頁跟關於頁需要的連結不一樣，所以這裡當一個必填 prop 往下傳，不是
 * 寫死在 `LangPageWrapper` 內部。
 *
 * `data-ui-theme`（2026-09-16 新增）——首頁/關於頁的「介面淺色/深色」
 * 使用者偏好，掛在這個最外層容器上，`globals.css` 的
 * `[data-ui-theme="light"]` 規則會覆寫 `--ui-bg`/`--ui-fg`/`--ui-muted`
 * 三個 CSS 變數（見 `home-sections.tsx`/`about-sections.tsx`/
 * `site-footer.tsx` 改用 `var(--ui-*)` 取代寫死的 hex）。這跟系列頁的
 * `theme`（dark/light/void）是不同的東西：系列頁底色是作品的一部分，
 * 由設計師決定，不受這顆開關影響（`work-page-client.tsx` 沒有用這支
 * wrapper，也沒有 `ThemeSwitchButton`）。跟 `lang` 一樣先只用 React
 * state，重新整理不記憶——語言切換原本就是這個行為，這裡先維持一致，
 * 沒有另外加 localStorage 持久化。
 */
export function LangPageWrapper({
  navVariant,
  hasBio = true,
  children,
}: {
  navVariant: "home" | "about";
  /** 簡介有沒有內容——沒有的話導覽不顯示「Bio」（首頁沒有 `#bio` 區塊，連結會是死的）。 */
  hasBio?: boolean;
  children: React.ReactNode;
}) {
  const [lang, setLang] = useState<"en" | "zh">("en");
  const [uiTheme, setUiTheme] = useState<"dark" | "light">("dark");

  return (
    <div data-lang={lang} data-ui-theme={uiTheme} className={langFontVariables}>
      <SiteNav variant={navVariant} lang={lang} hasBio={hasBio} />
      <div data-chrome className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
        <LangSwitchButton unpositioned lang={lang} onToggle={() => setLang((l) => (l === "en" ? "zh" : "en"))} />
        <ThemeSwitchButton uiTheme={uiTheme} onToggle={() => setUiTheme((t) => (t === "dark" ? "light" : "dark"))} />
      </div>
      {children}
    </div>
  );
}
