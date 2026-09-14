"use client";

import { useState, useTransition } from "react";
import { MediaMultiPicker, type MediaOption } from "@/components/admin/media-picker";
import { setFeaturedMedia } from "../actions";

/**
 * 首頁輪播的精選照選擇器（SPEC.md §4.2 輪播，見 HANDOFF.md）。獨立於
 * 系列基本資料表單，自己的存檔按鈕、自己的 server action——跟 Block
 * Editor 每個區塊各自存檔是同一種模式，不是塞進大表單裡一次送出。
 *
 * `mediaOptions` 只給「這個系列自己的」media（在 page.tsx 查詢時就已經
 * 用 collectionId 篩過），不是像 Block Editor 的媒材選擇器那樣給全部
 * 圖庫——精選照本來就該從「這個系列的圖」裡選，不會選到別系列的照片。
 */
export function FeaturedPhotosForm({
  collectionId,
  initialFeaturedIds,
  mediaOptions,
}: {
  collectionId: string;
  initialFeaturedIds: string[];
  mediaOptions: MediaOption[];
}) {
  const [selected, setSelected] = useState(initialFeaturedIds);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await setFeaturedMedia({ collectionId, mediaIds: selected });
      setMessage(
        result.ok ? { type: "ok", text: "已儲存" } : { type: "error", text: result.error },
      );
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded border p-3 text-sm">
      <div>
        <span className="font-medium">精選照（首頁輪播）</span>
        <p className="mt-1 text-xs text-neutral-500">
          從這個系列的圖庫裡勾選要出現在首頁輪播的照片，可拖曳調整順序。留空的話，首頁輪播會
          暫時改用這個系列依圖庫順序最前面的 3 張頂著，不會因為沒選而空白。
        </p>
      </div>
      <MediaMultiPicker value={selected} onChange={setSelected} mediaOptions={mediaOptions} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="self-start rounded border px-3 py-1 disabled:opacity-50"
        >
          {isPending ? "儲存中…" : "儲存精選照"}
        </button>
        {message && (
          <span className={message.type === "ok" ? "text-green-600" : "text-red-600"}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
