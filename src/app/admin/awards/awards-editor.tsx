"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState, useTransition } from "react";
import type { PickerCollection, PickerMedia } from "@/components/admin/media-meta";
import { useConfirm, useToast } from "@/components/admin/ui/feedback";
import { IconChevronDown, IconChevronUp, IconGrip, IconPlus, IconTrash, IconTrophy } from "@/components/admin/ui/icons";
import { ImageField } from "@/components/admin/ui/image-field";
import { Button, EmptyState, Field, IconButton, PageHeader, Switch, TextInput } from "@/components/admin/ui/primitives";
import { SaveBar } from "@/components/admin/ui/save-bar";
import { cn } from "@/components/admin/ui/styles";
import { saveAwards } from "./actions";

/**
 * 比賽經歷（2026-10-22 改版）：原本只能改證書圖與「是否公開」，獎項本身不能新增／修改／
 * 刪除／排序。現在每個獎項一張卡片，可以拖曳排序（順序就是首頁跑馬燈與關於頁的順序），
 * 所有變更按一次儲存。
 */

interface AwardRow {
  id: string;
  year: string;
  titleZh: string | null;
  titleEn: string | null;
  resultZh: string | null;
  resultEn: string | null;
  imageId: string | null;
  showCertificate: boolean;
}

interface Draft {
  key: string; // 新增的獎項還沒有 id，用暫時的 key 給 React / dnd-kit
  id: string | null;
  year: string;
  titleZh: string;
  titleEn: string;
  resultZh: string;
  resultEn: string;
  imageId: string | null;
  showCertificate: boolean;
}

const toDraft = (a: AwardRow): Draft => ({
  key: a.id,
  id: a.id,
  year: a.year,
  titleZh: a.titleZh ?? "",
  titleEn: a.titleEn ?? "",
  resultZh: a.resultZh ?? "",
  resultEn: a.resultEn ?? "",
  imageId: a.imageId,
  showCertificate: a.showCertificate,
});

/** 比對用：去掉只給 React 用的 `key`。 */
const comparable = (list: Draft[]) =>
  JSON.stringify(list.map((d) => [d.id, d.year, d.titleZh, d.titleEn, d.resultZh, d.resultEn, d.imageId, d.showCertificate]));

function AwardCard({
  draft,
  original,
  index,
  total,
  errors,
  onChange,
  onRemove,
  onMove,
  pickerMedia,
  pickerCollections,
}: {
  draft: Draft;
  original: Draft | undefined;
  index: number;
  total: number;
  errors: string[];
  onChange: (patch: Partial<Draft>) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  pickerMedia: PickerMedia[];
  pickerCollections: PickerCollection[];
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: draft.key });
  const changed = (k: keyof Draft) => !original || draft[k] !== original[k];
  const isNew = !draft.id;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "admin-fade-in rounded-2xl border bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-shadow",
        isDragging ? "admin-dragging relative" : "border-stone-200/80",
        errors.length > 0 && "border-red-300",
      )}
      data-award-key={draft.key}
    >
      <div className="flex items-center gap-2 border-b border-stone-100 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`拖曳調整順序（第 ${index + 1} 項）`}
          className="grid h-9 w-9 cursor-grab touch-none place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 active:cursor-grabbing"
        >
          <IconGrip size={18} />
        </button>
        <span className="text-xs tabular-nums text-stone-400">{String(index + 1).padStart(2, "0")}</span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-stone-900">
          {draft.year && <span className="mr-2 tabular-nums text-stone-500">{draft.year}</span>}
          {draft.titleZh || draft.titleEn || <span className="font-normal text-stone-400">新獎項</span>}
        </p>
        {isNew && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">新增</span>}
        {/* 卡片很高，拖曳要跨好幾個螢幕；上移/下移一鍵完成（手機上尤其好用） */}
        <IconButton label="上移" size="sm" disabled={index === 0} onClick={() => onMove(-1)}>
          <IconChevronUp size={17} />
        </IconButton>
        <IconButton label="下移" size="sm" disabled={index === total - 1} onClick={() => onMove(1)}>
          <IconChevronDown size={17} />
        </IconButton>
        <IconButton label="刪除這個獎項" variant="ghost" onClick={onRemove} className="text-stone-400 hover:bg-red-50 hover:text-red-600">
          <IconTrash size={17} />
        </IconButton>
      </div>
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_1fr_17rem]">
        <div className="grid gap-4 sm:grid-cols-[7rem_1fr] lg:col-span-2">
          <Field label="年份" changed={!isNew && changed("year")}>
            <TextInput
              value={draft.year}
              onChange={(e) => onChange({ year: e.target.value })}
              inputMode="numeric"
              placeholder="2026"
              invalid={errors.includes("year")}
            />
          </Field>
          <Field label="中文名稱" changed={!isNew && changed("titleZh")}>
            <TextInput value={draft.titleZh} onChange={(e) => onChange({ titleZh: e.target.value })} invalid={errors.includes("title")} placeholder="例如：金點新秀設計獎" />
          </Field>
          <div className="hidden sm:block" />
          <Field label="英文名稱" changed={!isNew && changed("titleEn")} hint="沒有官方英譯可以留空，前台只顯示中文。">
            <TextInput value={draft.titleEn} onChange={(e) => onChange({ titleEn: e.target.value })} invalid={errors.includes("title")} placeholder="例如：Young Pin Design Award" />
          </Field>
          <div className="hidden sm:block" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="成績（中文）" changed={!isNew && changed("resultZh")}>
              <TextInput value={draft.resultZh} onChange={(e) => onChange({ resultZh: e.target.value })} placeholder="第一名、優勝…" />
            </Field>
            <Field label="成績（英文）" changed={!isNew && changed("resultEn")}>
              <TextInput value={draft.resultEn} onChange={(e) => onChange({ resultEn: e.target.value })} placeholder="First Place, Winner…" />
            </Field>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <ImageField
            label="證書"
            value={draft.imageId}
            onChange={(v) => onChange({ imageId: v, showCertificate: v ? draft.showCertificate : false })}
            media={pickerMedia}
            collections={pickerCollections}
            changed={!isNew && changed("imageId")}
            aspect="aspect-[3/4]"
          />
          <Switch
            checked={draft.showCertificate}
            onChange={(v) => onChange({ showCertificate: v })}
            disabled={!draft.imageId}
            label="在關於頁公開證書"
            description={draft.imageId ? "關閉時證書只存在後台備查，前台看不到。" : "先選一張證書圖片才能公開。"}
          />
        </div>
      </div>
      {errors.length > 0 && (
        <p className="border-t border-red-100 bg-red-50/60 px-5 py-2.5 text-xs text-red-700">
          {errors.includes("year") && "請填年份。"}
          {errors.includes("title") && "中文或英文名稱至少要填一個。"}
        </p>
      )}
    </li>
  );
}

export function AwardsEditor({
  initialAwards,
  pickerMedia,
  pickerCollections,
}: {
  initialAwards: AwardRow[];
  pickerMedia: PickerMedia[];
  pickerCollections: PickerCollection[];
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [saved, setSaved] = useState<Draft[]>(() => initialAwards.map(toDraft));
  const [items, setItems] = useState<Draft[]>(saved);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isSaving, startSaving] = useTransition();
  const tempKey = useRef(0);

  const savedById = new Map(saved.map((d) => [d.key, d]));
  const deletedIds = saved.filter((s) => !items.some((i) => i.id === s.id)).map((s) => s.id as string);
  const dirty = comparable(items) !== comparable(saved);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function patch(key: string, p: Partial<Draft>) {
    setItems((prev) => prev.map((d) => (d.key === key ? { ...d, ...p } : d)));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: [] }));
  }

  function add() {
    const key = `new-${++tempKey.current}`;
    setItems((prev) => [
      ...prev,
      { key, id: null, year: String(new Date().getFullYear()), titleZh: "", titleEn: "", resultZh: "", resultEn: "", imageId: null, showCertificate: false },
    ]);
    // 等新卡片畫出來再捲過去、聚焦名稱欄位
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const card = document.querySelector<HTMLElement>(`[data-award-key="${key}"]`);
        card?.scrollIntoView({ behavior: "smooth", block: "center" });
        card?.querySelectorAll<HTMLInputElement>("input")[1]?.focus({ preventScroll: true });
      }),
    );
  }

  async function remove(d: Draft) {
    if (d.id) {
      const ok = await confirm({
        title: `刪除「${d.titleZh || d.titleEn || "這個獎項"}」？`,
        description: "按下儲存後才會真的刪除；在那之前可以按「捨棄」復原。證書圖片本身會留在圖庫。",
        confirmLabel: "刪除",
        tone: "danger",
      });
      if (!ok) return;
    }
    setItems((prev) => prev.filter((x) => x.key !== d.key));
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => arrayMove(prev, index, target));
    // 讓移動後的卡片留在視線內
    const key = items[index].key;
    requestAnimationFrame(() =>
      document.querySelector(`[data-award-key="${key}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => arrayMove(prev, prev.findIndex((d) => d.key === active.id), prev.findIndex((d) => d.key === over.id)));
  }

  function save() {
    const nextErrors: Record<string, string[]> = {};
    for (const d of items) {
      const e: string[] = [];
      if (!d.year.trim()) e.push("year");
      if (!d.titleZh.trim() && !d.titleEn.trim()) e.push("title");
      if (e.length) nextErrors[d.key] = e;
    }
    setErrors(nextErrors);
    const firstKey = Object.keys(nextErrors)[0];
    if (firstKey) {
      toast("error", "有獎項資料不完整");
      document.querySelector(`[data-award-key="${firstKey}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    startSaving(async () => {
      const result = await saveAwards({
        items: items.map((d) => ({
          id: d.id,
          year: d.year,
          titleZh: d.titleZh,
          titleEn: d.titleEn,
          resultZh: d.resultZh,
          resultEn: d.resultEn,
          imageId: d.imageId,
          showCertificate: d.imageId ? d.showCertificate : false,
        })),
        deletedIds,
      });
      if (result.ok) {
        const next = items.map((d, i) => ({
          ...d,
          id: result.ids[i],
          key: result.ids[i],
          year: d.year.trim(),
          titleZh: d.titleZh.trim(),
          titleEn: d.titleEn.trim(),
          resultZh: d.resultZh.trim(),
          resultEn: d.resultEn.trim(),
          showCertificate: d.imageId ? d.showCertificate : false,
        }));
        setSaved(next);
        setItems(next);
        toast("success", "已儲存", "首頁跑馬燈與關於頁已同步更新");
      } else {
        toast("error", "儲存失敗", result.error);
      }
    });
  }

  async function discard() {
    if (await confirm({ title: "捨棄所有未儲存的變更？", description: "新增、刪除、排序與修改都會回到上次儲存的狀態。", confirmLabel: "捨棄變更", tone: "danger" })) {
      setItems(saved);
      setErrors({});
    }
  }

  // 變更數：刪除的＋新增或欄位有改的＋（順序有變就再算一項）
  const fieldsChanged = items.filter((d) => !d.id || comparable([d]) !== comparable([savedById.get(d.key)!])).length;
  const keptIds = saved.map((s) => s.id).filter((id) => items.some((i) => i.id === id));
  const orderChanged = JSON.stringify(items.filter((d) => d.id).map((d) => d.id)) !== JSON.stringify(keptIds);
  const changeCount = deletedIds.length + fieldsChanged + (orderChanged ? 1 : 0);

  return (
    <>
      <PageHeader
        title="比賽經歷"
        description="拖曳左側把手、或按 ↑ ↓ 調整順序——這個順序就是首頁獲獎跑馬燈與關於頁清單的順序。"
        actions={
          <Button variant="primary" icon={<IconPlus size={16} />} onClick={add}>
            新增獎項
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={<IconTrophy size={22} />}
          title="還沒有任何獎項"
          description="首頁跑馬燈與關於頁的獲獎經歷在有資料前不會顯示。"
          action={
            <Button size="sm" variant="primary" icon={<IconPlus size={15} />} onClick={add}>
              新增第一個獎項
            </Button>
          }
        />
      ) : (
        <DndContext id="awards-editor" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((d) => d.key)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-4">
              {items.map((d, i) => (
                <AwardCard
                  key={d.key}
                  draft={d}
                  original={savedById.get(d.key)}
                  index={i}
                  total={items.length}
                  errors={errors[d.key] ?? []}
                  onChange={(p) => patch(d.key, p)}
                  onRemove={() => void remove(d)}
                  onMove={(delta) => move(i, delta)}
                  pickerMedia={pickerMedia}
                  pickerCollections={pickerCollections}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <SaveBar dirty={dirty} saving={isSaving} onSave={save} onDiscard={discard} changeCount={changeCount} />
    </>
  );
}
