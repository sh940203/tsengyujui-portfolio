"use client";

import Image from "next/image";
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
 *
 * 2026-09-19 更新：業主指出兩個問題——(1) 選了多張看不出來哪張是左圖、
 * 哪張是右圖，只能自己數奇偶數；(2) 後端邏輯原本只用第 1、2 張，選第
 * 3 張以後的照片完全沒作用，等於「選多張」是假的。這批：
 * - 後端（`src/lib/media/featured.ts`）改成依序兩兩一組湊出多對，選得
 *   越多、首頁輪播那個系列的組合越多，不是固定死只有一對
 * - 這裡新增 `PairPreview`——把 `selected` 陣列依序兩兩分組，每組明確
 *   標「第 N 對」＋「左 Left / 右 Right」，不用再靠數奇偶數猜
 */
function PairPreview({ selected, mediaOptions }: { selected: string[]; mediaOptions: MediaOption[] }) {
  const lookup = new Map(mediaOptions.map((option) => [option.id, option]));

  const pairs: { left: MediaOption; right: MediaOption }[] = [];
  for (let i = 0; i + 1 < selected.length; i += 2) {
    const left = lookup.get(selected[i]);
    const right = lookup.get(selected[i + 1]);
    if (left && right) pairs.push({ left, right });
  }
  const leftover = selected.length % 2 === 1 ? lookup.get(selected[selected.length - 1]) : null;

  if (selected.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded border border-dashed p-2">
      <div className="text-[10px] text-neutral-500">
        首頁輪播的配對預覽——依上面「已選」的順序，每兩張自動湊一對（左／右），跟正式首頁的邏輯完全一樣
      </div>
      <div className="flex flex-wrap gap-3">
        {pairs.map((pair, i) => (
          <div key={pair.left.id + pair.right.id} className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-neutral-500">第 {i + 1} 對</span>
            <div className="flex gap-1">
              <div className="flex flex-col items-center gap-0.5">
                <div className="relative h-14 w-14 overflow-hidden rounded border">
                  <Image src={pair.left.r2Key} alt="" fill sizes="56px" style={{ objectFit: "cover" }} />
                </div>
                <span className="text-[9px] text-neutral-500">左 Left</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <div className="relative h-14 w-14 overflow-hidden rounded border">
                  <Image src={pair.right.r2Key} alt="" fill sizes="56px" style={{ objectFit: "cover" }} />
                </div>
                <span className="text-[9px] text-neutral-500">右 Right</span>
              </div>
            </div>
          </div>
        ))}
        {leftover && (
          <div className="flex flex-col gap-1 opacity-50">
            <span className="text-[10px] font-medium text-neutral-500">落單，不會使用</span>
            <div className="relative h-14 w-14 overflow-hidden rounded border">
              <Image src={leftover.r2Key} alt="" fill sizes="56px" style={{ objectFit: "cover" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
          暫時改用這個系列依圖庫順序最前面的 4 張頂著，不會因為沒選而空白。
        </p>
        <p className="mt-1 text-xs text-amber-600">
          首頁是左右兩欄同時輪播，同一時間顯示的兩張圖一定來自同一個系列——下面「已選」的順序
          每兩張自動湊一對（第 1、2 張是第一對，第 3、4 張是第二對，以此類推），選得越多對，這個
          系列在首頁輪播裡出現的組合就越多。選奇數張時最後一張會落單、不會被使用，下面的配對
          預覽會直接標出來。
        </p>
      </div>
      <MediaMultiPicker value={selected} onChange={setSelected} mediaOptions={mediaOptions} />
      <PairPreview selected={selected} mediaOptions={mediaOptions} />
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
