"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CollectionBlocksRender } from "@/components/blocks/render/block-render";
import type { RenderBlock, RenderMediaOption, RenderTheme } from "@/components/blocks/render/types";

function consentStorageKey(slug: string) {
  return `consent:${slug}`;
}

/**
 * 內容提示層（SPEC.md §4.3、§12.11）——`requiresConsent` 是內容禮貌機制，
 * 不是存取控制：只擋 UI 顯示，不擋直接請求圖片網址或爬蟲。確認狀態存
 * `sessionStorage`（同一分頁 session 內不重複詢問，關掉分頁或開新分頁
 * 會重新詢問，符合規格「同一 session」的字面意思）。
 *
 * `consented` 用 `null` 表示「還沒檢查完 sessionStorage」——SSR 階段無法
 * 存取 `sessionStorage`，這批寧可讓內容多等一個 render tick 才出現，也
 * 不要在不需要提示的系列上也閃一下、或在需要提示的系列上閃出內容本體。
 */
function ConsentGate({
  slug,
  noteEn,
  noteZh,
  onConfirm,
}: {
  slug: string;
  noteEn: string | null;
  noteZh: string | null;
  onConfirm: () => void;
}) {
  const router = useRouter();

  // 不用 `window.history.length > 1` 判斷能不能 `router.back()`——在新分頁
  // 直接開這個系列連結時，history 裡唯一的前一筆是瀏覽器分頁初始的空白
  // 頁，`length` 還是會 > 1，`back()` 會把使用者丟到一片空白，不是任何
  // 有意義的頁面（實測抓到的，不是預先猜的）。「返回」在這裡固定導回
  // 首頁，比「猜前一頁是不是真的存在內容」可靠。
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-black px-6 text-center text-[#F2F3F4]">
      <div className="max-w-md" style={{ fontSize: "0.95rem", lineHeight: 1.7 }}>
        {noteZh && <p>{noteZh}</p>}
        {noteEn && <p className="mt-2 opacity-60">{noteEn}</p>}
        {!noteZh && !noteEn && <p>此系列內容僅適合成年觀眾瀏覽。</p>}
      </div>
      <div className="flex items-center gap-4" style={{ fontSize: "0.75rem", letterSpacing: "0.1em" }}>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(consentStorageKey(slug), "granted");
            onConfirm();
          }}
          className="rounded border border-white/40 px-5 py-2 hover:bg-white/10"
        >
          進入 / ENTER
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded border border-white/10 px-5 py-2 opacity-70 hover:opacity-100"
        >
          返回 / BACK
        </button>
      </div>
    </div>
  );
}

/**
 * SPEC.md §6 的雙語言同時存在 DOM 機制還沒做（見 SPEC §13 項目 22，
 * 獨立於這批範圍）——先比照 admin iframe 預覽的做法，用一個簡單的
 * EN/ZH 切換鈕頂著，`Lang` 元件真的換掉的時候這支也要跟著換。
 */
export function WorkPageClient({
  slug,
  theme,
  titleEn,
  titleZh,
  requiresConsent,
  consentNoteEn,
  consentNoteZh,
  blocks,
  mediaOptions,
}: {
  slug: string;
  theme: RenderTheme;
  titleEn: string;
  titleZh: string | null;
  requiresConsent: boolean;
  consentNoteEn: string | null;
  consentNoteZh: string | null;
  blocks: RenderBlock[];
  mediaOptions: RenderMediaOption[];
}) {
  const [lang, setLang] = useState<"en" | "zh">("en");
  const [consented, setConsented] = useState<boolean | null>(requiresConsent ? null : true);

  useEffect(() => {
    if (!requiresConsent) return;
    setConsented(sessionStorage.getItem(consentStorageKey(slug)) === "granted");
  }, [requiresConsent, slug]);

  if (consented === null) return null;

  if (!consented) {
    return (
      <ConsentGate
        slug={slug}
        noteEn={consentNoteEn}
        noteZh={consentNoteZh}
        onConfirm={() => setConsented(true)}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setLang((l) => (l === "en" ? "zh" : "en"))}
        className="fixed top-4 right-4 z-50 rounded border border-white/30 bg-black/50 px-2 py-1 text-[10px] text-white"
      >
        {lang.toUpperCase()}
      </button>
      <CollectionBlocksRender
        theme={theme}
        blocks={blocks}
        mediaOptions={mediaOptions}
        lang={lang}
        titleEn={titleEn}
        titleZh={titleZh}
      />
    </>
  );
}
