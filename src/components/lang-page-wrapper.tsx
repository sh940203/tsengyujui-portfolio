"use client";

import { useState } from "react";
import { langFontVariables } from "@/components/lang";

/**
 * 任何一個「整頁」層級需要 EN/ZH 切換鈕 + `data-lang` 的頁面共用這支——
 * 原本只有首頁需要，定義在 `home-page-client.tsx`；關於頁上線後變成
 * 第二個消費者，搬到這個中性位置（跟 `lang.tsx` 當初搬家理由一樣）。
 * 內容本身維持 Server Component、用 `children` 傳進來。
 */
export function LangPageWrapper({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<"en" | "zh">("en");

  return (
    <div data-lang={lang} className={langFontVariables}>
      <button
        type="button"
        onClick={() => setLang((l) => (l === "en" ? "zh" : "en"))}
        className="fixed top-4 right-4 z-50 rounded border border-white/30 bg-black/50 px-2 py-1 text-[10px] text-white"
      >
        {lang.toUpperCase()}
      </button>
      {children}
    </div>
  );
}
