"use client";

import Image from "next/image";
import { useDeferredValue, useMemo, useState } from "react";
import { KIND_LABEL_ZH, MEDIA_KINDS, type AdminMediaKind, type PickerCollection, type PickerMedia } from "../media-meta";
import { Button, Field, Select, TextInput, cn } from "./primitives";
import { IconCheck, IconImage, IconSearch } from "./icons";
import { Modal } from "./overlay";

/**
 * 圖片欄位＋縮圖選擇器（2026-10-22）。原本封面圖、OG 圖、證書這些欄位都是一長串
 * 「檔名 · kind」的下拉選單——要從 86 個檔名裡猜哪張是哪張。現在是：欄位顯示目前選的
 * 縮圖，按「選擇圖片」打開縮圖牆，可以依系列、類型篩選或搜尋檔名/替代文字，點一下選取、
 * 雙擊直接套用。
 */

export function MediaPickerDialog({
  open,
  onClose,
  onSelect,
  media,
  collections,
  initialCollectionId,
  selectedId,
  title = "選擇圖片",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  media: PickerMedia[];
  collections: PickerCollection[];
  initialCollectionId?: string | null;
  selectedId?: string | null;
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [kind, setKind] = useState<AdminMediaKind | "all">("all");
  const [collection, setCollection] = useState<string>(initialCollectionId ?? "all");
  const [picked, setPicked] = useState<string | null>(selectedId ?? null);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return media.filter((m) => {
      if (kind !== "all" && m.kind !== kind) return false;
      if (collection === "none" && m.collectionId !== null) return false;
      if (collection !== "all" && collection !== "none" && m.collectionId !== collection) return false;
      if (!q) return true;
      return [m.filename, m.altEn, m.altZh].some((v) => v?.toLowerCase().includes(q));
    });
  }, [media, kind, collection, deferredQuery]);

  function apply(id: string | null) {
    if (!id) return;
    onSelect(id);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={title}
      description="點一下選取、雙擊直接套用。可以依系列、類型篩選，或搜尋檔名與替代文字。"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" disabled={!picked} onClick={() => apply(picked)}>
            使用這張
          </Button>
        </>
      }
    >
      <div className="sticky top-0 z-10 -mx-1 mb-4 flex flex-col gap-2 bg-white px-1 pb-2 sm:flex-row">
        <TextInput
          leading={<IconSearch size={16} />}
          placeholder="搜尋檔名或替代文字"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:w-64"
        />
        <Select value={collection} onChange={(e) => setCollection(e.target.value)} aria-label="系列" className="sm:w-48">
          <option value="all">全部系列</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
          <option value="none">未指派系列</option>
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value as AdminMediaKind | "all")} aria-label="類型" className="sm:w-36">
          <option value="all">全部類型</option>
          {MEDIA_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL_ZH[k]}
            </option>
          ))}
        </Select>
        <span className="self-center text-xs text-stone-400 sm:ml-auto">{filtered.length} 張</span>
      </div>
      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-stone-500">沒有符合條件的圖片</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {filtered.map((m) => {
            const isPicked = picked === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setPicked(m.id)}
                  onDoubleClick={() => apply(m.id)}
                  aria-pressed={isPicked}
                  title={m.filename ?? undefined}
                  className={cn(
                    "group relative block aspect-square w-full overflow-hidden rounded-lg bg-stone-100 outline-none ring-offset-2 transition-[box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-stone-900/40",
                    isPicked ? "ring-2 ring-stone-900" : "hover:ring-2 hover:ring-stone-300",
                  )}
                >
                  <Image
                    src={m.r2Key}
                    alt={m.altZh ?? m.altEn ?? m.filename ?? ""}
                    fill
                    sizes="(max-width: 640px) 30vw, 160px"
                    style={{ objectFit: "cover" }}
                    className="transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                  <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">
                    {KIND_LABEL_ZH[m.kind]}
                  </span>
                  {isPicked && (
                    <span className="admin-pop absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-stone-900 text-white shadow">
                      <IconCheck size={14} strokeWidth={2.4} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

export function ImageField({
  label,
  hint,
  value,
  onChange,
  media,
  collections,
  defaultCollectionId,
  changed,
  aspect = "aspect-[4/3]",
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  media: PickerMedia[];
  collections: PickerCollection[];
  defaultCollectionId?: string | null;
  changed?: boolean;
  aspect?: string;
}) {
  const [open, setOpen] = useState(false);
  // 每次打開都重新掛載（`key`），選取狀態從目前的值開始；關閉時維持掛載讓退場動畫播完
  const [openCount, setOpenCount] = useState(0);
  const show = () => {
    setOpenCount((n) => n + 1);
    setOpen(true);
  };
  const current = value ? media.find((m) => m.id === value) ?? null : null;

  return (
    <Field label={label} hint={hint} changed={changed}>
      <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/60 p-2.5">
        <button
          type="button"
          onClick={show}
          className={cn(
            "relative w-24 shrink-0 overflow-hidden rounded-lg bg-stone-200/70 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-stone-900/30 sm:w-28",
            aspect,
          )}
          aria-label={current ? `更換${label}` : `選擇${label}`}
        >
          {current ? (
            <Image src={current.r2Key} alt="" fill sizes="112px" style={{ objectFit: "cover" }} className="admin-fade-in" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-stone-400">
              <IconImage size={22} />
            </span>
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="truncate text-[13px] text-stone-600">
            {current ? current.filename ?? "（未命名）" : <span className="text-stone-400">尚未選擇</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={show}>
              {current ? "更換" : "選擇圖片"}
            </Button>
            {current && (
              <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
                移除
              </Button>
            )}
          </div>
        </div>
      </div>
      {openCount > 0 && (
        <MediaPickerDialog
          key={openCount}
          open={open}
          onClose={() => setOpen(false)}
          onSelect={(id) => onChange(id)}
          media={media}
          collections={collections}
          initialCollectionId={current?.collectionId ?? defaultCollectionId ?? "all"}
          selectedId={value}
          title={`選擇${label}`}
        />
      )}
    </Field>
  );
}
