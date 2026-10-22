"use client";

import Image from "next/image";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { KIND_LABEL_ZH, MEDIA_KINDS, type AdminMediaKind, type PickerCollection } from "@/components/admin/media-meta";
import { useConfirm, useToast } from "@/components/admin/ui/feedback";
import { IconAlert, IconCheck, IconEyeOff, IconImage, IconSearch, IconStar, IconUpload, IconX } from "@/components/admin/ui/icons";
import { Button, EmptyState, PageHeader, Select, TextInput } from "@/components/admin/ui/primitives";
import { cn } from "@/components/admin/ui/styles";
import { batchDeleteMedia, batchUpdateCollection, batchUpdateKind } from "./actions";
import { MediaDetailSheet } from "./media-detail-sheet";
import { PageDropZone, UploadQueuePanel, useUploader } from "./uploader";

export interface LibraryItem {
  id: string;
  r2Key: string;
  filename: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  rotation: number;
  focalX: number;
  focalY: number;
  altEn: string | null;
  altZh: string | null;
  kind: AdminMediaKind;
  collectionId: string | null;
  galleryHidden: boolean;
  featuredOrder: number | null;
  createdAt: number;
  usage: string[];
}

type Filter = "missing-alt" | null;

export function MediaLibraryClient({
  initialItems,
  collections,
  initialFilter,
  initialCollection,
  openUpload,
}: {
  initialItems: LibraryItem[];
  collections: PickerCollection[];
  initialFilter: Filter;
  initialCollection: string | null;
  openUpload: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [kind, setKind] = useState<AdminMediaKind | "all">("all");
  const [collection, setCollection] = useState<string>(initialCollection ?? "all");
  const [missingAlt, setMissingAlt] = useState(initialFilter === "missing-alt");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastClicked = useRef<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isBatching, startBatch] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const collectionLabel = useMemo(() => new Map(collections.map((c) => [c.id, c.label])), [collections]);

  const baseFiltered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return items.filter((m) => {
      if (collection === "none" && m.collectionId !== null) return false;
      if (collection !== "all" && collection !== "none" && m.collectionId !== collection) return false;
      if (missingAlt && (m.altEn || m.altZh)) return false;
      if (q && ![m.filename, m.altEn, m.altZh].some((v) => v?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [items, collection, missingAlt, deferredQuery]);
  const filtered = useMemo(() => (kind === "all" ? baseFiltered : baseFiltered.filter((m) => m.kind === kind)), [baseFiltered, kind]);
  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of baseFiltered) counts.set(m.kind, (counts.get(m.kind) ?? 0) + 1);
    return counts;
  }, [baseFiltered]);

  // ── 上傳 ─────────────────────────────────────────
  const uploadTarget = {
    collectionId: collection !== "all" && collection !== "none" ? collection : null,
    kind: (kind === "all" ? "misc" : kind) as AdminMediaKind,
  };
  const targetLabel = `${uploadTarget.collectionId ? `「${collectionLabel.get(uploadTarget.collectionId)}」` : "未指派系列"}・${KIND_LABEL_ZH[uploadTarget.kind]}`;
  const handleUploaded = useCallback((row: Omit<LibraryItem, "usage" | "createdAt"> & { createdAt: Date | number }) => {
    const createdAt = row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime();
    setItems((prev) => [{ ...row, createdAt, usage: [] } as LibraryItem, ...prev]);
  }, []);
  const { queue, upload, clear } = useUploader(handleUploaded);
  const startUpload = (files: File[]) => void upload(files, uploadTarget);

  useEffect(() => {
    if (openUpload) fileInput.current?.click();
  }, [openUpload]);

  // ── 選取 ─────────────────────────────────────────
  const selecting = selected.size > 0;
  function toggleSelect(index: number, shift: boolean) {
    const id = filtered[index].id;
    // 先把錨點存起來：updater 會延後到 render 時才執行，那時 lastClicked 已經被改成這次的 index
    const anchor = lastClicked.current;
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && anchor !== null) {
        const [a, b] = [anchor, index].sort((x, y) => x - y);
        for (let i = a; i <= b; i++) next.add(filtered[i].id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastClicked.current = index;
  }
  const clearSelection = () => {
    setSelected(new Set());
    lastClicked.current = null;
  };
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !sheetOpen && clearSelection();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting, sheetOpen]);

  const selectedIds = [...selected];

  function batchKind(value: string) {
    if (!value) return;
    const k = value as AdminMediaKind;
    startBatch(async () => {
      try {
        await batchUpdateKind({ mediaIds: selectedIds, kind: k });
        setItems((prev) => prev.map((m) => (selected.has(m.id) ? { ...m, kind: k } : m)));
        toast("success", `已把 ${selectedIds.length} 張設成「${KIND_LABEL_ZH[k]}」`);
      } catch {
        toast("error", "批次設定失敗", "請再試一次");
      }
    });
  }
  function batchCollection(value: string) {
    if (!value) return;
    const collectionId = value === "none" ? null : value;
    startBatch(async () => {
      try {
        await batchUpdateCollection({ mediaIds: selectedIds, collectionId });
        setItems((prev) =>
          prev.map((m) =>
            selected.has(m.id) && m.collectionId !== collectionId
              ? { ...m, collectionId, galleryHidden: false, featuredOrder: null }
              : m,
          ),
        );
        toast("success", `已把 ${selectedIds.length} 張指派到${collectionId ? `「${collectionLabel.get(collectionId)}」` : "未指派系列"}`);
      } catch {
        toast("error", "批次指派失敗", "請再試一次");
      }
    });
  }
  async function batchDelete() {
    const inUse = items.filter((m) => selected.has(m.id) && m.usage.length > 0);
    const ok = await confirm({
      title: `永久刪除 ${selectedIds.length} 張圖片？`,
      description: (
        <>
          會刪除所有尺寸與原始檔，無法復原。
          {inUse.length > 0 && (
            <span className="mt-3 block rounded-lg bg-red-50 px-3 py-2 text-red-700">
              其中 {inUse.length} 張正在使用中（{inUse.flatMap((m) => m.usage).slice(0, 3).join("、")}
              {inUse.flatMap((m) => m.usage).length > 3 ? "…" : ""}），刪除後那些地方會變成沒有圖。
            </span>
          )}
        </>
      ),
      confirmLabel: "永久刪除",
      tone: "danger",
    });
    if (!ok) return;
    startBatch(async () => {
      try {
        await batchDeleteMedia({ mediaIds: selectedIds });
        setItems((prev) => prev.filter((m) => !selected.has(m.id)));
        toast("success", `已刪除 ${selectedIds.length} 張`);
        clearSelection();
      } catch {
        toast("error", "刪除失敗", "請再試一次");
      }
    });
  }

  // ── 單張面板 ───────────────────────────────────────
  const activeIndex = activeId ? filtered.findIndex((m) => m.id === activeId) : -1;
  const activeItem = activeId ? items.find((m) => m.id === activeId) ?? null : null;
  const openItem = (id: string) => {
    setActiveId(id);
    setSheetOpen(true);
  };

  const missingAltCount = items.filter((m) => m.collectionId && !m.altEn && !m.altZh).length;

  return (
    <>
      <PageHeader
        title="圖庫"
        description={`共 ${items.length} 張。點圖片編輯類型、系列、替代文字與裁切焦點；勾選多張可以一次處理。`}
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = "";
                if (files.length) startUpload(files);
              }}
            />
            <Button variant="primary" icon={<IconUpload size={16} />} onClick={() => fileInput.current?.click()}>
              上傳圖片
            </Button>
          </>
        }
      />

      {/* 篩選列 */}
      <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-stone-200/80 bg-stone-100/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex gap-2">
            <TextInput
              leading={<IconSearch size={16} />}
              placeholder="搜尋檔名或替代文字"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="lg:w-60"
              aria-label="搜尋"
            />
            <Select value={collection} onChange={(e) => setCollection(e.target.value)} aria-label="系列" className="w-40 sm:w-48">
              <option value="all">全部系列</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
              <option value="none">未指派系列</option>
            </Select>
          </div>
          {/* 手機橫向捲動；桌機換行，不會被裁掉 */}
          <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] lg:flex-1 lg:flex-wrap lg:overflow-visible">
            {(["all", ...MEDIA_KINDS] as const).map((k) => {
              const count = k === "all" ? baseFiltered.length : kindCounts.get(k) ?? 0;
              const active = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-colors duration-150",
                    active ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-inset ring-stone-200 hover:text-stone-900 hover:ring-stone-300",
                  )}
                >
                  {k === "all" ? "全部" : KIND_LABEL_ZH[k]}
                  <span className={cn("tabular-nums text-xs", active ? "text-white/60" : "text-stone-400")}>{count}</span>
                </button>
              );
            })}
            <span className="mx-1 h-5 w-px shrink-0 bg-stone-300 lg:hidden" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setMissingAlt((v) => !v)}
              aria-pressed={missingAlt}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-colors duration-150 lg:ml-auto",
                missingAlt ? "bg-amber-500 text-white" : "bg-white text-stone-600 ring-1 ring-inset ring-stone-200 hover:text-stone-900",
              )}
            >
              <IconAlert size={14} />
              缺替代文字
              <span className={cn("tabular-nums text-xs", missingAlt ? "text-white/70" : "text-stone-400")}>{missingAltCount}</span>
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconImage size={22} />}
          title={items.length === 0 ? "圖庫還是空的" : "沒有符合條件的圖片"}
          description={items.length === 0 ? "拖放圖片到這個頁面任何地方，或按右上角「上傳圖片」。" : "換個篩選條件試試看。"}
          action={
            items.length > 0 ? (
              <Button
                size="sm"
                onClick={() => {
                  setQuery("");
                  setKind("all");
                  setCollection("all");
                  setMissingAlt(false);
                }}
              >
                清除篩選
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {filtered.map((m, index) => {
            const isSelected = selected.has(m.id);
            const noAlt = !m.altEn && !m.altZh;
            return (
              <li key={m.id} className="group admin-fade-in relative">
                <button
                  type="button"
                  onClick={(e) => (selecting ? toggleSelect(index, e.shiftKey) : openItem(m.id))}
                  className={cn(
                    "relative block aspect-square w-full overflow-hidden rounded-xl bg-stone-200 outline-none transition-[box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2",
                    isSelected ? "ring-[3px] ring-stone-900 ring-offset-2 ring-offset-stone-100" : "hover:shadow-lg",
                  )}
                  aria-label={`${m.filename ?? "圖片"}${selecting ? (isSelected ? "，已選取" : "，未選取") : "，開啟詳細資料"}`}
                >
                  <Image
                    src={m.r2Key}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 46vw, (max-width: 1280px) 24vw, 220px"
                    style={{ objectFit: "cover", objectPosition: `${m.focalX * 100}% ${m.focalY * 100}%` }}
                    className={cn("transition-transform duration-500 group-hover:scale-[1.04]", isSelected && "scale-[0.97]")}
                  />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
                  <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 text-[11px] font-medium text-white">
                    {KIND_LABEL_ZH[m.kind]}
                    {m.galleryHidden && <IconEyeOff size={13} aria-label="長廊隱藏" />}
                    {m.featuredOrder !== null && !m.galleryHidden && <IconStar size={13} filled className="text-amber-300" aria-label="首頁精選" />}
                  </span>
                  {noAlt && (
                    <span className="pointer-events-none absolute bottom-2 right-2 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-stone-900" title="缺替代文字">
                      <IconAlert size={12} strokeWidth={2} />
                    </span>
                  )}
                </button>
                {/* 勾選框：滑鼠懸停或已在選取模式時出現；觸控裝置一律顯示 */}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={`選取 ${m.filename ?? "圖片"}`}
                  onClick={(e) => toggleSelect(index, e.shiftKey)}
                  className={cn(
                    "absolute left-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-lg transition-opacity duration-150 [@media(hover:none)]:opacity-100",
                    selecting || isSelected ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-md border-2 shadow-sm transition-colors duration-150",
                      isSelected ? "border-stone-900 bg-stone-900 text-white" : "border-white bg-black/25 text-transparent backdrop-blur-sm",
                    )}
                  >
                    <IconCheck size={14} strokeWidth={2.6} />
                  </span>
                </button>
                <div className="mt-1.5 px-0.5">
                  <p className="truncate text-xs text-stone-700">{m.filename ?? "（未命名）"}</p>
                  <p className="truncate text-[11px] text-stone-400">{m.collectionId ? collectionLabel.get(m.collectionId) : "未指派系列"}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* 批次操作列 */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[transform,opacity] duration-300 ease-[cubic-bezier(.22,1,.36,1)] lg:left-64",
          selecting ? "translate-y-0 opacity-100" : "translate-y-[140%] opacity-0",
        )}
        aria-hidden={!selecting}
      >
        <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-2xl bg-stone-900 p-2.5 pl-4 text-white shadow-2xl shadow-stone-900/25">
          <p className="mr-auto text-sm tabular-nums" role="status">
            已選 {selected.size} 張
          </p>
          <button
            type="button"
            onClick={() => setSelected(new Set(filtered.map((m) => m.id)))}
            className="h-8 rounded-lg px-2.5 text-[13px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            tabIndex={selecting ? 0 : -1}
          >
            全選（{filtered.length}）
          </button>
          <select
            value=""
            onChange={(e) => batchKind(e.target.value)}
            disabled={isBatching}
            tabIndex={selecting ? 0 : -1}
            className="h-8 cursor-pointer rounded-lg border border-white/20 bg-white/10 px-2 text-[13px] text-white outline-none hover:bg-white/15 [&>option]:text-stone-900"
            aria-label="設定類型"
          >
            <option value="">設定類型…</option>
            {MEDIA_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL_ZH[k]}
              </option>
            ))}
          </select>
          <select
            value=""
            onChange={(e) => batchCollection(e.target.value)}
            disabled={isBatching}
            tabIndex={selecting ? 0 : -1}
            className="h-8 cursor-pointer rounded-lg border border-white/20 bg-white/10 px-2 text-[13px] text-white outline-none hover:bg-white/15 [&>option]:text-stone-900"
            aria-label="指派系列"
          >
            <option value="">指派系列…</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
            <option value="none">未指派系列</option>
          </select>
          <button
            type="button"
            onClick={batchDelete}
            disabled={isBatching}
            tabIndex={selecting ? 0 : -1}
            className="h-8 rounded-lg px-2.5 text-[13px] text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-200 disabled:opacity-40"
          >
            刪除
          </button>
          <button
            type="button"
            onClick={clearSelection}
            aria-label="取消選取（Esc）"
            tabIndex={selecting ? 0 : -1}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <IconX size={16} />
          </button>
        </div>
      </div>

      <MediaDetailSheet
        item={activeItem}
        open={sheetOpen && !!activeItem}
        onClose={() => setSheetOpen(false)}
        onPrev={activeIndex > 0 ? () => setActiveId(filtered[activeIndex - 1].id) : null}
        onNext={activeIndex >= 0 && activeIndex < filtered.length - 1 ? () => setActiveId(filtered[activeIndex + 1].id) : null}
        position={activeIndex >= 0 ? `${activeIndex + 1} / ${filtered.length}` : ""}
        collections={collections}
        onUpdated={(patch) => setItems((prev) => prev.map((m) => (m.id === patch.id ? { ...m, ...patch } : m)))}
        onDeleted={(id) => {
          const next = filtered[activeIndex + 1] ?? filtered[activeIndex - 1];
          setItems((prev) => prev.filter((m) => m.id !== id));
          if (next && next.id !== id) setActiveId(next.id);
          else setSheetOpen(false);
        }}
      />

      <PageDropZone onFiles={startUpload} targetLabel={targetLabel} />
      <UploadQueuePanel queue={queue} onClose={clear} />
    </>
  );
}
