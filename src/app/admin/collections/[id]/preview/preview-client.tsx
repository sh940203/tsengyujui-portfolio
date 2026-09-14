"use client";

import { useEffect, useRef, useState } from "react";
import { CollectionBlocksRender } from "@/components/blocks/render/block-render";
import {
  PREVIEW_READY_SOURCE,
  PREVIEW_UPDATE_SOURCE,
  type PreviewBlock,
  type PreviewMediaOption,
  type PreviewReadyMessage,
  type PreviewTheme,
  type PreviewUpdateMessage,
} from "@/lib/blocks/preview-message";

function isPreviewUpdateMessage(data: unknown): data is PreviewUpdateMessage {
  return !!data && typeof data === "object" && (data as { source?: unknown }).source === PREVIEW_UPDATE_SOURCE;
}

/**
 * 這支只負責「收 postMessage、更新畫面」，實際渲染在
 * `CollectionBlocksRender`（`src/components/blocks/render/block-render.tsx`）
 * ——這支跟 `/work/[slug]` 前台正式頁現在共用同一份渲染元件，這支容器本身
 * （postMessage 監聽、SSR 初始資料、EN/ZH 切換鈕）維持不動，不屬於這批
 * 「元件搬遷 + 套設計系統」的範圍。
 */
export function PreviewClient({
  initialTheme,
  initialBlocks,
  initialMediaOptions,
}: {
  initialTheme: PreviewTheme;
  initialBlocks: PreviewBlock[];
  initialMediaOptions: PreviewMediaOption[];
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [mediaOptions, setMediaOptions] = useState(initialMediaOptions);
  const [lang, setLang] = useState<"en" | "zh">("en");
  const hasSentReady = useRef(false);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // 雖然是同源 iframe，仍防禦性檢查來源，不信任任意 origin 送來的內容。
      if (event.origin !== window.location.origin) return;
      if (!isPreviewUpdateMessage(event.data)) return;
      setTheme(event.data.theme);
      setBlocks(event.data.blocks);
      setMediaOptions(event.data.mediaOptions);
    }
    window.addEventListener("message", handleMessage);

    if (!hasSentReady.current) {
      hasSentReady.current = true;
      const readyMessage: PreviewReadyMessage = { source: PREVIEW_READY_SOURCE };
      window.parent.postMessage(readyMessage, window.location.origin);
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setLang((l) => (l === "en" ? "zh" : "en"))}
        className="fixed top-2 right-2 z-50 rounded border border-white/30 bg-black/50 px-2 py-1 text-[10px] text-white"
      >
        {lang.toUpperCase()}
      </button>
      <CollectionBlocksRender theme={theme} blocks={blocks} mediaOptions={mediaOptions} lang={lang} />
    </>
  );
}
