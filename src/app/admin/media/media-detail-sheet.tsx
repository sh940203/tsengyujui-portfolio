"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import r2ImageLoader from "@/lib/media/image-loader";
import { KIND_LABEL_ZH, MEDIA_KINDS, type AdminMediaKind, type PickerCollection } from "@/components/admin/media-meta";
import { useConfirm, useSaveShortcut, useToast } from "@/components/admin/ui/feedback";
import {
  IconAlert,
  IconChevronLeft,
  IconChevronRight,
  IconCrosshair,
  IconRotate,
  IconTrash,
  IconX,
} from "@/components/admin/ui/icons";
import { Sheet } from "@/components/admin/ui/overlay";
import { Button, Field, IconButton, Select, TextArea } from "@/components/admin/ui/primitives";
import { cn } from "@/components/admin/ui/styles";
import { batchDeleteMedia, rotateMedia, updateMediaDetails } from "./actions";
import type { LibraryItem } from "./media-library-client";

/**
 * 單張圖的編輯面板（桌機從右側滑出、手機從底部滑上來）。
 * - 點預覽圖設定裁切焦點，旁邊兩個小框即時顯示「正方形」「3:4」裁切後的樣子
 * - 旋轉是立即生效的操作（伺服器要重新產生四個尺寸，按下去縮圖先用 CSS 轉給你看）
 * - 類型／系列／替代文字／焦點是一個表單，按儲存（或 ⌘S）才寫入；有未存變更時切換上下張或
 *   關閉面板會先問
 * - ← → 切換上一張/下一張（游標在輸入框裡時不會觸發），方便連續補替代文字
 */

const ROTATION_SEQUENCE = [0, 90, 180, 270] as const;

function preloadImage(url: string) {
  return new Promise<void>((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

function draftOf(item: LibraryItem) {
  return {
    kind: item.kind as AdminMediaKind,
    collectionId: item.collectionId,
    altEn: item.altEn ?? "",
    altZh: item.altZh ?? "",
    focalX: item.focalX,
    focalY: item.focalY,
  };
}
type Draft = ReturnType<typeof draftOf>;

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function MediaDetailSheet({
  item,
  open,
  onClose,
  onPrev,
  onNext,
  position,
  collections,
  onUpdated,
  onDeleted,
}: {
  item: LibraryItem | null;
  open: boolean;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  position: string;
  collections: PickerCollection[];
  onUpdated: (patch: Partial<LibraryItem> & { id: string }) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(item ? draftOf(item) : null);
  const [isSaving, startSaving] = useTransition();
  const [isRotating, setRotating] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const loadedFor = useRef<string | null>(item?.id ?? null);

  // 換到另一張圖時重設草稿（同一張圖在背景被更新，例如旋轉完成，不覆蓋正在編輯的內容）
  useEffect(() => {
    if (item && loadedFor.current !== item.id) {
      loadedFor.current = item.id;
      setDraft(draftOf(item));
    }
  }, [item]);

  const saved = item ? draftOf(item) : null;
  const dirty = !!(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));

  async function guard(action: () => void) {
    if (dirty) {
      const ok = await confirm({
        title: "這張圖還有變更沒儲存",
        description: "要捨棄變更嗎？",
        confirmLabel: "捨棄變更",
        cancelLabel: "繼續編輯",
        tone: "danger",
      });
      if (!ok) return;
    }
    action();
  }

  function save() {
    if (!item || !draft || !dirty) return;
    startSaving(async () => {
      const result = await updateMediaDetails({ mediaId: item.id, ...draft });
      if (result.ok) {
        const movedOut = draft.collectionId !== item.collectionId;
        onUpdated({
          id: item.id,
          ...draft,
          altEn: draft.altEn.trim() || null,
          altZh: draft.altZh.trim() || null,
          ...(movedOut ? { galleryHidden: false, featuredOrder: null } : {}),
        });
        toast("success", "已儲存", "前台已同步更新");
      } else {
        toast("error", "儲存失敗", result.error);
      }
    });
  }
  useSaveShortcut(save, open && dirty && !isSaving);

  // ← → 切換（游標在輸入框時不觸發）
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === "ArrowLeft" && onPrev) void guard(onPrev);
      if (e.key === "ArrowRight" && onNext) void guard(onNext);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function rotate() {
    if (!item) return;
    const i = ROTATION_SEQUENCE.indexOf(item.rotation as (typeof ROTATION_SEQUENCE)[number]);
    const next = ROTATION_SEQUENCE[(i + 1) % 4];
    setRotating(true);
    try {
      const result = await rotateMedia({ mediaId: item.id, rotation: next });
      await Promise.all([400, 800, 1600].map((w) => preloadImage(r2ImageLoader({ src: result.r2Key, width: w }))));
      onUpdated({ id: item.id, rotation: next, r2Key: result.r2Key, width: result.width, height: result.height });
      toast("success", `已旋轉到 ${next}°`, "前台會同步換成新的方向");
    } catch {
      toast("error", "旋轉失敗", "請再試一次");
    } finally {
      setRotating(false);
    }
  }

  async function remove() {
    if (!item) return;
    const ok = await confirm({
      title: "刪除這張圖片？",
      description: (
        <>
          會永久刪除所有尺寸與原始檔，無法復原。
          {item.usage.length > 0 && (
            <span className="mt-3 block rounded-lg bg-red-50 px-3 py-2 text-red-700">
              這張圖目前用在：{item.usage.join("、")}。刪除後那些地方會變成沒有圖。
            </span>
          )}
        </>
      ),
      confirmLabel: "永久刪除",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await batchDeleteMedia({ mediaIds: [item.id] });
      toast("success", "已刪除");
      onDeleted(item.id);
    } catch {
      toast("error", "刪除失敗", "請再試一次");
    } finally {
      setDeleting(false);
    }
  }

  function setFocal(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const focalX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const focalY = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setDraft((d) => (d ? { ...d, focalX: Math.round(focalX * 1000) / 1000, focalY: Math.round(focalY * 1000) / 1000 } : d));
  }

  const aspect = item?.width && item?.height ? item.width / item.height : 2 / 3;
  const objectPosition = draft ? `${draft.focalX * 100}% ${draft.focalY * 100}%` : "50% 50%";

  return (
    <Sheet open={open} onClose={() => void guard(onClose)} label="圖片詳細資料" width="lg">
      {item && draft && (
        <>
          <div className="flex items-center gap-1 border-b border-stone-100 px-3 py-2.5 sm:px-4">
            <IconButton label="上一張（←）" size="md" disabled={!onPrev} onClick={() => onPrev && void guard(onPrev)}>
              <IconChevronLeft size={18} />
            </IconButton>
            <IconButton label="下一張（→）" size="md" disabled={!onNext} onClick={() => onNext && void guard(onNext)}>
              <IconChevronRight size={18} />
            </IconButton>
            <div className="min-w-0 flex-1 px-2">
              <p className="truncate text-sm font-medium text-stone-900">{item.filename ?? "（未命名）"}</p>
              <p className="text-[11px] text-stone-400">{position}</p>
            </div>
            <IconButton label="關閉" onClick={() => void guard(onClose)}>
              <IconX size={18} />
            </IconButton>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="bg-stone-100 px-4 py-5 sm:px-6">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
                <div
                  key={item.r2Key}
                  onClick={setFocal}
                  className="admin-fade-in relative w-full cursor-crosshair overflow-hidden rounded-lg bg-stone-200 bg-cover bg-center shadow-sm"
                  // 先鋪一張已經在快取裡的小圖（縮圖牆/裁切預覽用的 400w），高解析大圖還在下載時不會是一片灰
                  style={{
                    aspectRatio: aspect,
                    maxWidth: `min(100%, calc(46dvh * ${aspect}))`,
                    backgroundImage: `url(${r2ImageLoader({ src: item.r2Key, width: 400 })})`,
                  }}
                  title="點一下設定裁切焦點"
                >
                  <Image
                    src={item.r2Key}
                    alt={item.altZh ?? item.altEn ?? ""}
                    fill
                    sizes="(max-width: 768px) 92vw, 520px"
                    style={{
                      objectFit: "cover",
                      transform: isRotating ? "rotate(90deg) scale(0.8)" : undefined,
                      transition: "transform 0.35s cubic-bezier(.22,1,.36,1)",
                    }}
                    draggable={false}
                  />
                  <span
                    className="pointer-events-none absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.3)] transition-[left,top] duration-200"
                    style={{ left: `${draft.focalX * 100}%`, top: `${draft.focalY * 100}%` }}
                  >
                    <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                  </span>
                  {isRotating && (
                    <span className="absolute inset-0 grid place-items-center bg-white/40 text-sm font-medium text-stone-700 backdrop-blur-[1px]">
                      旋轉中…
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 gap-3 sm:flex-col">
                  {[
                    { label: "正方形裁切", ratio: "aspect-square" },
                    { label: "3:4 裁切", ratio: "aspect-[3/4]" },
                  ].map((c) => (
                    <div key={c.label} className="flex flex-col items-center gap-1">
                      <div className={cn("relative w-20 overflow-hidden rounded-md bg-stone-200 ring-1 ring-stone-300", c.ratio)}>
                        <Image src={item.r2Key} alt="" fill sizes="80px" style={{ objectFit: "cover", objectPosition }} className="transition-[object-position] duration-200" />
                      </div>
                      <span className="text-[10px] text-stone-500">{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" variant="secondary" icon={<IconRotate size={15} />} onClick={rotate} loading={isRotating}>
                  旋轉 90°
                </Button>
                <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                  <IconCrosshair size={14} />
                  點圖片設定裁切焦點
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-5 px-4 py-5 sm:px-6">
              {item.usage.length > 0 && (
                <div className="rounded-xl bg-sky-50 px-3.5 py-3 text-[13px] text-sky-900">
                  <p className="font-medium">使用中</p>
                  <ul className="mt-1 list-inside list-disc text-sky-800">
                    {item.usage.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Field label="類型" changed={draft.kind !== saved?.kind}>
                <div role="radiogroup" aria-label="類型" className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {MEDIA_KINDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={draft.kind === k}
                      onClick={() => setDraft((d) => (d ? { ...d, kind: k } : d))}
                      className={cn(
                        "h-9 rounded-lg border text-[13px] transition-colors duration-150",
                        draft.kind === k
                          ? "border-stone-900 bg-stone-900 font-medium text-white"
                          : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900",
                      )}
                    >
                      {KIND_LABEL_ZH[k]}
                    </button>
                  ))}
                </div>
              </Field>

              <Field
                label="系列"
                changed={draft.collectionId !== saved?.collectionId}
                hint={
                  draft.collectionId !== saved?.collectionId && saved?.collectionId
                    ? "換系列後，這張圖在原系列長廊的排序、隱藏與首頁精選設定會一起清除。"
                    : undefined
                }
              >
                <Select value={draft.collectionId ?? ""} onChange={(e) => setDraft((d) => (d ? { ...d, collectionId: e.target.value || null } : d))}>
                  <option value="">未指派系列</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="替代文字（中文）" changed={draft.altZh !== saved?.altZh} counter={{ value: draft.altZh.length, max: 300 }} hint="描述畫面內容，給視障者與搜尋引擎。">
                  <TextArea minRows={2} value={draft.altZh} onChange={(e) => setDraft((d) => (d ? { ...d, altZh: e.target.value } : d))} placeholder="例如：模特兒穿著深藍外套坐在洗手台上" />
                </Field>
                <Field label="替代文字（英文）" changed={draft.altEn !== saved?.altEn} counter={{ value: draft.altEn.length, max: 300 }}>
                  <TextArea minRows={2} value={draft.altEn} onChange={(e) => setDraft((d) => (d ? { ...d, altEn: e.target.value } : d))} placeholder="e.g. Model in a navy jacket sitting on a sink" />
                </Field>
              </div>
              {!draft.altEn && !draft.altZh && (
                <p className="-mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                  <IconAlert size={14} />
                  目前沒有替代文字，前台會用「系列名＋類型＋序號」代替。
                </p>
              )}

              <dl className="grid grid-cols-3 gap-3 rounded-xl border border-stone-200 px-4 py-3 text-xs">
                <div>
                  <dt className="text-stone-400">尺寸</dt>
                  <dd className="mt-0.5 tabular-nums text-stone-700">{item.width && item.height ? `${item.width} × ${item.height}` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-stone-400">檔案大小</dt>
                  <dd className="mt-0.5 tabular-nums text-stone-700">{formatBytes(item.fileSize)}</dd>
                </div>
                <div>
                  <dt className="text-stone-400">上傳日期</dt>
                  <dd className="mt-0.5 tabular-nums text-stone-700" suppressHydrationWarning>
                    {new Date(item.createdAt).toLocaleDateString("zh-TW")}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-stone-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <Button variant="danger" size="md" icon={<IconTrash size={16} />} onClick={remove} loading={isDeleting}>
              <span className="hidden sm:inline">刪除</span>
            </Button>
            <span
              className={cn(
                "ml-auto text-xs transition-opacity duration-200",
                dirty ? "text-amber-700 opacity-100" : "opacity-0",
              )}
              aria-live="polite"
            >
              {dirty ? "有變更尚未儲存" : ""}
            </span>
            {dirty && (
              <Button variant="ghost" onClick={() => setDraft(saved)} disabled={isSaving}>
                還原
              </Button>
            )}
            <Button variant="primary" onClick={save} disabled={!dirty} loading={isSaving}>
              儲存
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
