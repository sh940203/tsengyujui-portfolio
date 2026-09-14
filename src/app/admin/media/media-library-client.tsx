"use client";

import { useMemo, useState, useTransition } from "react";
import type { collections, media } from "@/lib/db/schema";
import { UploadDropzone } from "./upload-dropzone";
import { MediaCard } from "./media-card";
import { batchDeleteMedia, batchUpdateCollection, batchUpdateKind } from "./actions";

type MediaRow = typeof media.$inferSelect;
type CollectionOption = Pick<typeof collections.$inferSelect, "id" | "slug" | "titleEn">;

const KIND_OPTIONS = ["final", "detail", "sketch", "poster", "process", "misc"] as const;

export function MediaLibraryClient({
  initialMedia,
  collections: collectionOptions,
}: {
  initialMedia: MediaRow[];
  collections: CollectionOption[];
}) {
  const [items, setItems] = useState(initialMedia);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterKind, setFilterKind] = useState<string>("all");
  const [filterCollection, setFilterCollection] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filterKind !== "all" && item.kind !== filterKind) return false;
      if (filterCollection === "unassigned" && item.collectionId !== null) return false;
      if (
        filterCollection !== "all" &&
        filterCollection !== "unassigned" &&
        item.collectionId !== filterCollection
      )
        return false;
      return true;
    });
  }, [items, filterKind, filterCollection]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleUploaded(newItem: MediaRow) {
    setItems((prev) => [newItem, ...prev]);
  }

  function handleUpdated(updated: Partial<MediaRow> & { id: string }) {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    );
  }

  function handleDeleted(ids: string[]) {
    setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
  }

  const selectedIds = [...selected];

  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="text-xl font-medium">圖庫</h1>

      <div className="mt-4">
        <UploadDropzone onUploaded={handleUploaded} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          kind
          <select
            className="rounded border px-2 py-1"
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
          >
            <option value="all">全部</option>
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          系列
          <select
            className="rounded border px-2 py-1"
            value={filterCollection}
            onChange={(e) => setFilterCollection(e.target.value)}
          >
            <option value="all">全部</option>
            <option value="unassigned">未指定</option>
            {collectionOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.slug}
              </option>
            ))}
          </select>
        </label>

        <span className="text-neutral-500">
          共 {filtered.length} 張，已選 {selected.size} 張
        </span>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded border bg-neutral-50 p-3 text-sm">
          <span>批次操作（{selected.size} 張）：</span>

          <select
            className="rounded border px-2 py-1"
            disabled={isPending}
            defaultValue=""
            onChange={(e) => {
              const kind = e.target.value;
              if (!kind) return;
              startTransition(async () => {
                await batchUpdateKind({ mediaIds: selectedIds, kind: kind as MediaRow["kind"] });
                setItems((prev) =>
                  prev.map((item) =>
                    selected.has(item.id) ? { ...item, kind: kind as MediaRow["kind"] } : item,
                  ),
                );
              });
              e.target.value = "";
            }}
          >
            <option value="">設定 kind…</option>
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          <select
            className="rounded border px-2 py-1"
            disabled={isPending}
            defaultValue=""
            onChange={(e) => {
              const value = e.target.value;
              if (value === "") return;
              const collectionId = value === "none" ? null : value;
              startTransition(async () => {
                await batchUpdateCollection({ mediaIds: selectedIds, collectionId });
                setItems((prev) =>
                  prev.map((item) =>
                    selected.has(item.id) ? { ...item, collectionId } : item,
                  ),
                );
              });
              e.target.value = "";
            }}
          >
            <option value="">指派系列…</option>
            <option value="none">（無）</option>
            {collectionOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.slug}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="rounded border border-red-600 px-3 py-1 text-red-600 disabled:opacity-50"
            disabled={isPending}
            onClick={() => {
              if (!confirm(`確定要刪除選取的 ${selected.size} 張圖片？此動作無法復原。`)) {
                return;
              }
              startTransition(async () => {
                await batchDeleteMedia({ mediaIds: selectedIds });
                handleDeleted(selectedIds);
                clearSelection();
              });
            }}
          >
            刪除選取
          </button>

          <button type="button" className="text-neutral-500 underline" onClick={clearSelection}>
            取消選取
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            collections={collectionOptions}
            selected={selected.has(item.id)}
            onToggleSelect={() => toggleSelect(item.id)}
            onUpdated={handleUpdated}
            onDeleted={() => handleDeleted([item.id])}
          />
        ))}
      </div>
    </main>
  );
}
