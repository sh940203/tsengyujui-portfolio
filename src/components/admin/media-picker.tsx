"use client";

import Image from "next/image";
import { useId } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface MediaOption {
  id: string;
  r2Key: string;
  filename: string | null;
  kind: string;
}

function Thumb({ option, selected }: { option: MediaOption; selected: boolean }) {
  return (
    <div
      className={`relative aspect-square overflow-hidden rounded border-2 ${
        selected ? "border-blue-500" : "border-transparent"
      }`}
      title={option.filename ?? option.id}
    >
      <Image src={option.r2Key} alt={option.filename ?? ""} fill sizes="72px" style={{ objectFit: "cover" }} />
    </div>
  );
}

/** 單選圖片選擇器——縮圖網格，不是貼 media id 字串。 */
export function MediaPicker({
  value,
  onChange,
  mediaOptions,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  mediaOptions: MediaOption[];
}) {
  return (
    <div className="max-h-56 overflow-y-auto rounded border p-2">
      <div className="grid grid-cols-6 gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`flex aspect-square items-center justify-center rounded border-2 text-[10px] text-neutral-500 ${
            value === null ? "border-blue-500" : "border-neutral-200"
          }`}
        >
          （無）
        </button>
        {mediaOptions.map((option) => (
          <button key={option.id} type="button" onClick={() => onChange(option.id)}>
            <Thumb option={option} selected={value === option.id} />
          </button>
        ))}
      </div>
    </div>
  );
}

function SortableSelectedThumb({
  option,
  onRemove,
}: {
  option: MediaOption;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: option.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="block w-full cursor-grab active:cursor-grabbing"
        title={option.filename ?? option.id}
      >
        <Thumb option={option} selected />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="移除"
        className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] leading-none text-white"
      >
        ×
      </button>
    </div>
  );
}

/**
 * 多選圖片選擇器——mediaIds 陣列用。已選的項目獨立顯示成一排、可以拖曳
 * 排序（原本只能靠「先移除再重新加入」變相調整順序，這是已知限制，見
 * HANDOFF.md/SPEC.md §10.4，這次順便補上——區塊編輯器的媒材選擇跟首頁
 * 精選照選擇器共用這支元件跟同一套排序手感，不要兩套並存）。
 *
 * 互動方式因此跟之前不一樣：點擊「圖庫」網格是新增（附加到已選最後），
 * 不再是「點擊已選的縮圖切換移除」——已選的縮圖現在用來拖曳，移除要按
 * 縮圖右上角的 × 。
 */
export function MediaMultiPicker({
  value,
  onChange,
  mediaOptions,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  mediaOptions: MediaOption[];
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  // dnd-kit 的 DndContext 預設用內部模組級的遞增計數器產生
  // aria-describedby 這類無障礙用的 id——一個頁面裡如果同時有多個
  // MediaMultiPicker（例如這批新增的功能讓一個系列頁可能同時有
  // triptych、detail-strip 兩個 media-list 欄位），SSR 跟 client
  // hydration 算出來的編號對不上，會觸發 React hydration mismatch
  // （實測跑出來的，不是預先猜的）。dnd-kit 官方文件建議明確傳入穩定的
  // `id` prop 取代內部計數器；`useId()` 是 React 18 專門為了這種 SSR/CSR
  // 一致性設計的 hook，用它產生的值一定 SSR/client 相同。
  const dndContextId = useId();

  const selectedOptions = value
    .map((id) => mediaOptions.find((option) => option.id === id))
    .filter((option): option is MediaOption => !!option);
  const availableOptions = mediaOptions.filter((option) => !value.includes(option.id));

  function add(id: string) {
    onChange([...value, id]);
  }

  function remove(id: string) {
    onChange(value.filter((existing) => existing !== id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = value.indexOf(active.id as string);
    const newIndex = value.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(value, oldIndex, newIndex));
  }

  return (
    <div className="flex flex-col gap-2">
      {selectedOptions.length > 0 && (
        <div className="rounded border p-2">
          <div className="mb-1 text-[10px] text-neutral-500">已選（可拖曳排序）</div>
          <DndContext
            id={dndContextId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={value} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-6 gap-2">
                {selectedOptions.map((option) => (
                  <SortableSelectedThumb key={option.id} option={option} onRemove={() => remove(option.id)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <div className="max-h-56 overflow-y-auto rounded border p-2">
        <div className="mb-1 text-[10px] text-neutral-500">圖庫（點擊加入）</div>
        <div className="grid grid-cols-6 gap-2">
          {availableOptions.map((option) => (
            <button key={option.id} type="button" onClick={() => add(option.id)}>
              <Thumb option={option} selected={false} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
