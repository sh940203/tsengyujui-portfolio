"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import type { collections, media } from "@/lib/db/schema";
import {
  batchDeleteMedia,
  rotateMedia,
  updateMediaAlt,
  updateMediaCollection,
  updateMediaFocal,
  updateMediaKind,
} from "./actions";

type MediaRow = typeof media.$inferSelect;
type CollectionOption = Pick<typeof collections.$inferSelect, "id" | "slug" | "titleEn">;

const KIND_OPTIONS = ["final", "detail", "sketch", "poster", "process", "misc"] as const;
const ROTATION_SEQUENCE = [0, 90, 180, 270] as const;

export function MediaCard({
  item,
  collections: collectionOptions,
  selected,
  onToggleSelect,
  onUpdated,
  onDeleted,
}: {
  item: MediaRow;
  collections: CollectionOption[];
  selected: boolean;
  onToggleSelect: () => void;
  onUpdated: (updated: Partial<MediaRow> & { id: string }) => void;
  onDeleted: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [focalMode, setFocalMode] = useState(false);
  const [altEn, setAltEn] = useState(item.altEn ?? "");
  const [altZh, setAltZh] = useState(item.altZh ?? "");

  function handleRotate() {
    const currentIndex = ROTATION_SEQUENCE.indexOf(item.rotation as (typeof ROTATION_SEQUENCE)[number]);
    const nextRotation = ROTATION_SEQUENCE[(currentIndex + 1) % ROTATION_SEQUENCE.length];
    startTransition(async () => {
      await rotateMedia({ mediaId: item.id, rotation: nextRotation });
      onUpdated({ id: item.id, rotation: nextRotation });
    });
  }

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!focalMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const focalX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const focalY = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    startTransition(async () => {
      await updateMediaFocal({ mediaId: item.id, focalX, focalY });
      onUpdated({ id: item.id, focalX, focalY });
    });
    setFocalMode(false);
  }

  function handleKindChange(kind: string) {
    startTransition(async () => {
      await updateMediaKind({ mediaId: item.id, kind: kind as MediaRow["kind"] });
      onUpdated({ id: item.id, kind: kind as MediaRow["kind"] });
    });
  }

  function handleCollectionChange(value: string) {
    const collectionId = value === "none" ? null : value;
    startTransition(async () => {
      await updateMediaCollection({ mediaId: item.id, collectionId });
      onUpdated({ id: item.id, collectionId });
    });
  }

  function handleAltBlur() {
    if (altEn === (item.altEn ?? "") && altZh === (item.altZh ?? "")) return;
    startTransition(async () => {
      await updateMediaAlt({ mediaId: item.id, altEn, altZh });
      onUpdated({ id: item.id, altEn: altEn || null, altZh: altZh || null });
    });
  }

  function handleDelete() {
    if (!confirm("確定要刪除這張圖片？此動作無法復原。")) return;
    startTransition(async () => {
      await batchDeleteMedia({ mediaIds: [item.id] });
      onDeleted();
    });
  }

  return (
    <div className={`rounded border p-2 text-xs ${selected ? "border-blue-500 ring-1 ring-blue-500" : "border-neutral-200"}`}>
      <div className="flex items-center justify-between pb-1">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} />
        <span className="truncate text-neutral-400" title={item.filename ?? undefined}>
          {item.filename}
        </span>
      </div>

      <div
        className={`relative aspect-square overflow-hidden rounded bg-neutral-100 ${focalMode ? "cursor-crosshair" : ""}`}
        onClick={handleImageClick}
      >
        <Image
          src={item.r2Key}
          alt={item.altEn ?? item.filename ?? ""}
          fill
          sizes="200px"
          style={{
            objectFit: "cover",
            objectPosition: `${item.focalX * 100}% ${item.focalY * 100}%`,
          }}
        />
        {focalMode && (
          <div
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500"
            style={{ left: `${item.focalX * 100}%`, top: `${item.focalY * 100}%` }}
          />
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <button
          type="button"
          className="rounded border px-2 py-0.5 disabled:opacity-50"
          disabled={isPending}
          onClick={handleRotate}
          title="旋轉 90°"
        >
          旋轉 {item.rotation}°
        </button>
        <button
          type="button"
          className={`rounded border px-2 py-0.5 ${focalMode ? "bg-red-100" : ""}`}
          onClick={() => setFocalMode((v) => !v)}
          title="點圖片設定焦點"
        >
          {focalMode ? "點圖片設焦點…" : "設焦點"}
        </button>
        <button
          type="button"
          className="rounded border border-red-400 px-2 py-0.5 text-red-600 disabled:opacity-50"
          disabled={isPending}
          onClick={handleDelete}
        >
          刪除
        </button>
      </div>

      <select
        className="mt-1 w-full rounded border px-1 py-0.5"
        value={item.kind}
        disabled={isPending}
        onChange={(e) => handleKindChange(e.target.value)}
      >
        {KIND_OPTIONS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>

      <select
        className="mt-1 w-full rounded border px-1 py-0.5"
        value={item.collectionId ?? "none"}
        disabled={isPending}
        onChange={(e) => handleCollectionChange(e.target.value)}
      >
        <option value="none">（無系列）</option>
        {collectionOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.slug}
          </option>
        ))}
      </select>

      <input
        className="mt-1 w-full rounded border px-1 py-0.5"
        placeholder="Alt (EN)"
        value={altEn}
        onChange={(e) => setAltEn(e.target.value)}
        onBlur={handleAltBlur}
      />
      <input
        className="mt-1 w-full rounded border px-1 py-0.5"
        placeholder="Alt (ZH)"
        value={altZh}
        onChange={(e) => setAltZh(e.target.value)}
        onBlur={handleAltBlur}
      />
    </div>
  );
}
