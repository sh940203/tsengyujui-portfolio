"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdjacentCollectionLink, RenderTheme } from "@/components/blocks/render/types";
import { LangSwitchButton } from "@/components/lang-switch-button";
import { SiteNav } from "@/components/site-nav";
import type { GalleryStyle } from "@/lib/collections/gallery-style";
import type { GalleryItem } from "@/lib/collections/get-series-gallery";
import { SeriesGallery } from "./series-gallery";

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
 * 系列內頁外殼：同意提示層、左上導航、EN/ZH 切換鈕，內容交給
 * `SeriesGallery`（2026-09-20 改版：左欄固定敘述、右欄捲動系列全部作品）。
 */
export function WorkPageClient({
  slug,
  theme,
  galleryStyle,
  titleEn,
  titleZh,
  statementEn,
  statementZh,
  year,
  category,
  pieceCount,
  requiresConsent,
  consentNoteEn,
  consentNoteZh,
  items,
  prev,
  next,
}: {
  slug: string;
  theme: RenderTheme;
  galleryStyle: GalleryStyle;
  titleEn: string;
  titleZh: string | null;
  statementEn: string | null;
  statementZh: string | null;
  year: string | null;
  category: string | null;
  pieceCount: number | null;
  requiresConsent: boolean;
  consentNoteEn: string | null;
  consentNoteZh: string | null;
  items: GalleryItem[];
  prev: AdjacentCollectionLink | null;
  next: AdjacentCollectionLink | null;
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
      <SiteNav variant="work" />
      <LangSwitchButton lang={lang} onToggle={() => setLang((l) => (l === "en" ? "zh" : "en"))} />
      <SeriesGallery
        style={galleryStyle}
        theme={theme}
        lang={lang}
        titleEn={titleEn}
        titleZh={titleZh}
        statementEn={statementEn}
        statementZh={statementZh}
        year={year}
        category={category}
        pieceCount={pieceCount}
        items={items}
        prev={prev}
        next={next}
      />
    </>
  );
}
