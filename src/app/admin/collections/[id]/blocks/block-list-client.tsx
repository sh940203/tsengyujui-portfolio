"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { BlockTypeEnum, type BlockType } from "@/lib/blocks/schemas";
import type { blocks } from "@/lib/db/schema";
import {
  PREVIEW_READY_SOURCE,
  PREVIEW_UPDATE_SOURCE,
  type PreviewReadyMessage,
  type PreviewTheme,
  type PreviewUpdateMessage,
} from "@/lib/blocks/preview-message";
import {
  createBlock,
  deleteBlock,
  publishCollection,
  reorderBlocks,
  updateBlockConfig,
} from "./actions";
import { GenericBlockForm } from "./generic-block-form";
import type { MediaOption } from "@/components/admin/media-picker";

function isPreviewReadyMessage(data: unknown): data is PreviewReadyMessage {
  return !!data && typeof data === "object" && (data as { source?: unknown }).source === PREVIEW_READY_SOURCE;
}

type BlockRow = typeof blocks.$inferSelect;

const BLOCK_TYPES = BlockTypeEnum.options;

// 三批展開完成，全部 12 種區塊都用生成式表單：
// 第一批 full-bleed / statement / spacer（enum、localized-text、media，不含
// boolean、media-list）；第二批 detail-strip / sketch-cluster（唯二同時含
// boolean 與 media-list 的 schema，兩種欄位型別在此批對真實資料庫做過完整
// 的新增/調整順序/刪除單一項目/boolean 三態往返驗證）；第三批 pair /
// triptych / single / text-image / divider / lens / mirror（field renderer
// 邏輯已在前兩批驗證過，這批用單值往返做智能收斂測試，不重複跑完整流程）。
// 詳見 HANDOFF.md。JsonConfigEditor 保留作為未來新增區塊類型時的備援路徑。
const GENERATED_FORM_TYPES = new Set<BlockType>(BLOCK_TYPES);

/**
 * 「上次發布：{時間}」的日期格式化故意延到掛載後才在 client 端做，不要在
 * render 時直接呼叫 `toLocaleString`——這是 Server Component 傳下來的
 * `Date`，第一次 render 在 server 端也會跑過一次（Next.js 對 client
 * component 的 SSR pass），Node 跟瀏覽器的 ICU 資料在正中午 12 點附近對
 * 「上午/下午」的判斷不保證一致，會產生逐字元不同的字串，觸發 React
 * hydration mismatch（實測跑出來的，不是理論推測——測試時間點剛好落在中午
 * 12 點多，兩次都真的觸發了）。SSR 跟第一次 client render 統一先顯示
 * `null`（一致，不會 mismatch），掛載後的 effect 才在瀏覽器自己的
 * locale/timezone 下算出字串——這樣顯示的也才是管理者自己所在時區看到的
 * 時間，語意上也比在 server 端用 server 的時區格式化更正確。
 */
function PublishedAtLabel({ publishedAt }: { publishedAt: Date }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(publishedAt.toLocaleString("zh-TW"));
  }, [publishedAt]);

  return <span className="text-neutral-600">上次發布：{text ?? "…"}</span>;
}

function JsonConfigEditor({
  block,
  onSaveConfig,
}: {
  block: BlockRow;
  onSaveConfig: (config: unknown) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [configText, setConfigText] = useState(() =>
    JSON.stringify(JSON.parse(block.config), null, 2),
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(
    null,
  );

  function handleSave() {
    setMessage(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(configText);
    } catch {
      setMessage({ type: "error", text: "不是合法的 JSON" });
      return;
    }
    startTransition(async () => {
      const result = await onSaveConfig(parsed);
      setMessage(
        result.ok ? { type: "ok", text: "已儲存" } : { type: "error", text: result.error },
      );
    });
  }

  return (
    <>
      <textarea
        className="mt-2 w-full rounded border px-2 py-1 font-mono text-xs"
        rows={6}
        value={configText}
        onChange={(e) => setConfigText(e.target.value)}
      />
      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="rounded border px-3 py-1 disabled:opacity-50"
        >
          {isPending ? "儲存中…" : "儲存設定"}
        </button>
        {message && (
          <span className={message.type === "ok" ? "text-green-600" : "text-red-600"}>
            {message.text}
          </span>
        )}
      </div>
    </>
  );
}

function SortableBlockRow({
  block,
  index,
  mediaOptions,
  onDelete,
  onSaveConfig,
  onLiveChange,
  onSaved,
}: {
  block: BlockRow;
  index: number;
  mediaOptions: MediaOption[];
  onDelete: () => void;
  onSaveConfig: (config: unknown) => Promise<{ ok: true } | { ok: false; error: string }>;
  onLiveChange: (config: Record<string, unknown>) => void;
  onSaved: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasGeneratedForm = GENERATED_FORM_TYPES.has(block.type as BlockType);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded border border-neutral-200 bg-white p-3 text-sm"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab rounded border px-2 py-1 active:cursor-grabbing"
          aria-label="拖曳排序"
        >
          ⠿
        </button>
        <span className="text-neutral-400">#{index + 1}</span>
        <span className="font-medium">{block.type}</span>
        {hasGeneratedForm && (
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">
            表單
          </span>
        )}
        <button
          type="button"
          className="ml-auto rounded border border-red-400 px-2 py-1 text-red-600"
          onClick={onDelete}
        >
          刪除
        </button>
      </div>

      {hasGeneratedForm ? (
        <GenericBlockForm
          type={block.type as BlockType}
          initialConfig={JSON.parse(block.config)}
          mediaOptions={mediaOptions}
          onSave={onSaveConfig}
          onChange={onLiveChange}
          onSaved={onSaved}
        />
      ) : (
        <JsonConfigEditor block={block} onSaveConfig={onSaveConfig} />
      )}
    </div>
  );
}

export function BlockListClient({
  collectionId,
  collectionTitle,
  theme,
  initialBlocks,
  mediaOptions,
  publishedAt,
  hasUnpublishedChanges: initialHasUnpublishedChanges,
}: {
  collectionId: string;
  collectionTitle: string;
  theme: PreviewTheme;
  initialBlocks: BlockRow[];
  mediaOptions: MediaOption[];
  publishedAt: Date | null;
  hasUnpublishedChanges: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialBlocks);
  const [newType, setNewType] = useState<BlockType>(BLOCK_TYPES[0]);
  const [isPending, startTransition] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);
  const [isPublishPending, startPublishTransition] = useTransition();
  const [publishError, setPublishError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 「有未發布的變更」是 server component 在 SSR 階段算好才傳下來的 prop
  // （比對草稿 blocks 跟 publishedSnapshot），本身不會隨著使用者在這個已經
  // 掛載的頁面上操作而自動更新——用跟 items/initialBlocks 一樣的既有模式
  // （見下面 `useEffect`）同步回 local state，另外讓單一區塊存檔成功時可以
  // 樂觀更新成 true（見 handleBlockSaved），不用整頁重新整理就能反映。
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(
    initialHasUnpublishedChanges,
  );

  useEffect(() => {
    setHasUnpublishedChanges(initialHasUnpublishedChanges);
  }, [initialHasUnpublishedChanges]);

  // 存檔動作本身就代表草稿被改了，直接樂觀設成 true，不用重新序列化整批
  // blocks 跟 publishedSnapshot 比對。唯一會誤報的情況是使用者把值改回跟
  // 已發布版本完全相同——這種情況下嚴格來說沒有變更，但跟現有其他
  // staleness（例如 items[].config 存檔後沒有立即刷新）的容忍度一致，不
  // 追求完美同步。
  function handleBlockSaved() {
    setHasUnpublishedChanges(true);
  }

  // 每個 GenericBlockForm 都有自己的本地 state；這裡被動收集每個區塊「目前
  // 表單上尚未存檔」的即時內容，key 是 block id。純粹供即時預覽使用，不影響
  // 任何存檔路徑——存檔仍然各自呼叫 onSaveConfig。
  const [liveConfigs, setLiveConfigs] = useState<Record<string, Record<string, unknown>>>(
    {},
  );

  function handleLiveChange(blockId: string, config: Record<string, unknown>) {
    setLiveConfigs((prev) => ({ ...prev, [blockId]: config }));
  }

  function sendPreviewUpdate() {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const message: PreviewUpdateMessage = {
      source: PREVIEW_UPDATE_SOURCE,
      theme,
      mediaOptions: mediaOptions.map((m) => ({
        id: m.id,
        r2Key: m.r2Key,
        filename: m.filename,
        altEn: m.altEn ?? null,
        altZh: m.altZh ?? null,
      })),
      blocks: items.map((b) => ({
        id: b.id,
        type: b.type as BlockType,
        config: (liveConfigs[b.id] ?? JSON.parse(b.config)) as Record<string, unknown>,
      })),
    };
    // 同源明確帶 targetOrigin，不用 "*"。
    win.postMessage(message, window.location.origin);
  }

  // handleReadyMessage 註冊在只跑一次的 effect 裡（下面），如果直接 closure
  // 住 sendPreviewUpdate 會抓到掛載當下那一輪的舊 items/liveConfigs——用 ref
  // 存「最新一版」的函式，每次 render 都覆蓋，effect 裡永遠呼叫 ref.current。
  const sendPreviewUpdateRef = useRef(sendPreviewUpdate);
  sendPreviewUpdateRef.current = sendPreviewUpdate;

  // SPEC.md §7.4 項目 5：表單變更後 debounce 300ms 更新預覽（吃即時輸入，
  // 不是存檔後）。items（拖曳排序/新增/刪除）跟 liveConfigs（表單輸入）任
  // 一個變動都算。
  useEffect(() => {
    const timer = setTimeout(() => sendPreviewUpdateRef.current(), 300);
    return () => clearTimeout(timer);
  }, [items, liveConfigs, theme, mediaOptions]);

  // iframe 剛掛載、它的 message listener 還沒註冊好之前送 postMessage 會
  // 直接遺失（不會排隊等下次），所以改成等 iframe 自己回報「我準備好了」
  // 再立刻送最新一份資料，不要用 debounce 賭時機。
  useEffect(() => {
    function handleReadyMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isPreviewReadyMessage(event.data)) return;
      sendPreviewUpdateRef.current();
    }
    window.addEventListener("message", handleReadyMessage);
    return () => window.removeEventListener("message", handleReadyMessage);
  }, []);

  // router.refresh()（用在新增之後）會讓 page.tsx 重新查詢、給這個元件新的
  // initialBlocks——用 effect 同步回 local state，表單/textarea 顯示的
  // 內容才會跟資料庫一致。
  useEffect(() => {
    setItems(initialBlocks);
  }, [initialBlocks]);

  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((b) => b.id === active.id);
    const newIndex = items.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(items, oldIndex, newIndex);

    // 呼叫 startTransition 必須跟 setItems 是平行的兩個陳述式，不能放進
    // setItems 的 updater function 裡——那個 updater 在 React（尤其
    // Strict Mode）底下可能被重複呼叫來檢查純度，在裡面呼叫 startTransition
    // 這種有副作用的東西會直接觸發 "Cannot call startTransition while
    // rendering"（實測跑出來的錯誤，不是猜的）。
    setItems(next);
    startTransition(async () => {
      await reorderBlocks({
        collectionId,
        orderedIds: next.map((b) => b.id),
      });
    });
  }

  function handleAdd() {
    setAddError(null);
    startTransition(async () => {
      const result = await createBlock({ collectionId, type: newType });
      if (!result.ok) {
        setAddError(result.error);
        return;
      }
      // 新區塊的 config 預設值是 server 端算出來的（見
      // defaultBlockConfig()），用 router.refresh() 重新取得 Server
      // Component 的資料，畫面顯示的內容才會跟資料庫一致，不用自己在
      // 前端猜一份可能不準的假資料出來。
      router.refresh();
    });
  }

  function handleDelete(blockId: string) {
    if (!confirm("確定要刪除這個區塊？此動作無法復原。")) return;
    startTransition(async () => {
      await deleteBlock({ id: blockId, collectionId });
      setItems((prev) => prev.filter((b) => b.id !== blockId));
    });
  }

  function handlePublish() {
    setPublishError(null);
    startPublishTransition(async () => {
      const result = await publishCollection({ collectionId });
      if (!result.ok) {
        setPublishError(result.error);
        return;
      }
      // 發布會影響「有沒有未發布變更」的顯示，那個狀態是 server component
      // 算好才傳下來的 prop，跟 handleAdd 同樣的理由要 router.refresh()
      // 才能拿到發布後的最新狀態。
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <Link href={`/admin/collections/${collectionId}`} className="text-sm underline">
          ← 回系列基本資料
        </Link>
        {/* 2026-10-22：系列頁自 2026-09-21 起直接讀圖庫，不再使用這裡的排版——業主決定從導覽收起，
            程式保留以備日後需要。進到這頁的人要先知道這件事，免得以為改了會反映到前台。 */}
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          區塊編輯器目前不影響前台。系列頁的作品長廊請到「系列 → 作品長廊」調整。
        </p>
        <h1 className="mt-2 text-xl font-medium">區塊：{collectionTitle}</h1>

        <div className="mt-3 flex items-center gap-3 rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <div className="flex-1">
            {publishedAt ? (
              <PublishedAtLabel publishedAt={publishedAt} />
            ) : (
              <span className="text-neutral-500">尚未發布過</span>
            )}
            {hasUnpublishedChanges && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700">
                有未發布的變更
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={isPublishPending}
            onClick={handlePublish}
            className="rounded border border-neutral-900 bg-neutral-900 px-3 py-1 text-white disabled:opacity-50"
          >
            {isPublishPending ? "發布中…" : "發布"}
          </button>
          {publishError && <span className="text-red-600">{publishError}</span>}
        </div>

        <div className="mt-4 flex items-center gap-3 text-sm">
          <select
            className="rounded border px-2 py-1"
            value={newType}
            onChange={(e) => setNewType(e.target.value as BlockType)}
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending}
            onClick={handleAdd}
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            新增區塊
          </button>
          {addError && <span className="text-red-600">{addError}</span>}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="mt-4 flex flex-col gap-3">
              {items.map((block, index) => (
                <SortableBlockRow
                  key={block.id}
                  block={block}
                  index={index}
                  mediaOptions={mediaOptions}
                  onDelete={() => handleDelete(block.id)}
                  onSaveConfig={(config) =>
                    updateBlockConfig({ id: block.id, collectionId, config })
                  }
                  onLiveChange={(config) => handleLiveChange(block.id, config)}
                  onSaved={handleBlockSaved}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {items.length === 0 && (
          <p className="mt-4 text-sm text-neutral-500">這個系列還沒有任何區塊。</p>
        )}
      </div>

      <div className="w-full shrink-0 lg:sticky lg:top-6 lg:w-[420px]">
        <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
          <span>即時預覽（結構預覽，非最終視覺）</span>
        </div>
        <iframe
          ref={iframeRef}
          src={`/admin/collections/${collectionId}/preview`}
          className="h-[70vh] w-full rounded border border-neutral-200"
          title="即時預覽"
        />
      </div>
    </div>
  );
}
