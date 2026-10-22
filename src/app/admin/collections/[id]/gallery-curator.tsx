"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import { useState } from "react";
import { KIND_LABEL_ZH, type AdminMediaKind } from "@/components/admin/media-meta";
import { cn } from "@/components/admin/ui/styles";
import { IconEye, IconEyeOff, IconGrip, IconStar, IconX } from "@/components/admin/ui/icons";

/**
 * 作品長廊的精選與排序（2026-10-22，業主要能自己決定 Cumedy 48 件裡顯示哪些、排什麼順序）。
 * - 拖曳縮圖調整順序：前台長廊完全照這個順序（滑鼠拖、手機長按後拖、鍵盤：Tab 到縮圖按
 *   空白鍵拿起 → 方向鍵移動 → 空白鍵放下）
 * - 眼睛：在前台隱藏／顯示這件作品（隱藏的仍留在這裡，只是變淡，隨時可以再打開）
 * - 星星：放進首頁輪播（隱藏的作品不能設成精選）
 */

export interface CuratorTile {
  id: string;
  r2Key: string;
  filename: string | null;
  kind: AdminMediaKind;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function TileBody({
  tile,
  position,
  hidden,
  featured,
  onToggleHidden,
  onToggleFeatured,
  overlay,
}: {
  tile: CuratorTile;
  position: number | null;
  hidden: boolean;
  featured: boolean;
  onToggleHidden?: () => void;
  onToggleFeatured?: () => void;
  overlay?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[3/4] overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200/80",
        overlay && "admin-dragging scale-[1.04]",
      )}
    >
      <Image
        src={tile.r2Key}
        alt=""
        fill
        draggable={false}
        sizes="(max-width: 640px) 32vw, 180px"
        style={{ objectFit: "cover" }}
        className={cn("pointer-events-none select-none transition-[filter,opacity] duration-300", hidden && "opacity-35 grayscale")}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/50 to-transparent" />

      <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white backdrop-blur-sm">
        {hidden ? "隱藏" : String(position).padStart(2, "0")}
      </span>

      {onToggleFeatured && (
        <button
          type="button"
          onClick={onToggleFeatured}
          onPointerDown={stop}
          onKeyDown={stop}
          disabled={hidden}
          aria-pressed={featured}
          aria-label={featured ? "移出首頁輪播" : "放進首頁輪播"}
          title={hidden ? "隱藏的作品不能放進首頁輪播" : featured ? "移出首頁輪播" : "放進首頁輪播"}
          className={cn(
            "absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-lg transition-[color,transform,background-color] duration-150 active:scale-90 disabled:opacity-30",
            featured ? "text-amber-300" : "text-white/80 hover:bg-black/30 hover:text-white",
          )}
        >
          <IconStar size={18} filled={featured} className={featured ? "admin-pop drop-shadow" : "drop-shadow"} />
        </button>
      )}

      <span className="pointer-events-none absolute bottom-2 left-2 text-[11px] font-medium text-white drop-shadow">
        {KIND_LABEL_ZH[tile.kind]}
      </span>

      {onToggleHidden && (
        <button
          type="button"
          onClick={onToggleHidden}
          onPointerDown={stop}
          onKeyDown={stop}
          aria-pressed={hidden}
          aria-label={hidden ? "在前台顯示" : "在前台隱藏"}
          title={hidden ? "在前台顯示" : "在前台隱藏"}
          className={cn(
            "absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-lg transition-[color,background-color,transform] duration-150 active:scale-90",
            hidden ? "bg-white text-stone-900 shadow" : "text-white/85 hover:bg-black/30 hover:text-white",
          )}
        >
          {hidden ? <IconEyeOff size={17} /> : <IconEye size={17} />}
        </button>
      )}
    </div>
  );
}

function SortableTile(props: {
  tile: CuratorTile;
  position: number | null;
  hidden: boolean;
  featured: boolean;
  onToggleHidden: () => void;
  onToggleFeatured: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.tile.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "cursor-grab touch-manipulation rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
      aria-label={`${props.tile.filename ?? "作品"}，${props.hidden ? "已隱藏" : `第 ${props.position} 件`}。按空白鍵拿起後用方向鍵移動`}
      {...attributes}
      {...listeners}
    >
      <TileBody {...props} />
    </li>
  );
}

export function GalleryCurator({
  tiles,
  order,
  hidden,
  featured,
  onReorder,
  onToggleHidden,
  onToggleFeatured,
}: {
  tiles: Map<string, CuratorTile>;
  order: string[];
  hidden: Set<string>;
  featured: Set<string>;
  onReorder: (next: string[]) => void;
  onToggleHidden: (id: string) => void;
  onToggleFeatured: (id: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  let visibleCount = 0;
  const positions = new Map<string, number | null>();
  for (const id of order) positions.set(id, hidden.has(id) ? null : ++visibleCount);

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(order, from, to));
  }

  const activeTile = activeId ? tiles.get(activeId) : null;

  return (
    <DndContext
      // 固定 id：dnd-kit 預設用全域遞增計數器產生 aria-describedby，伺服器與瀏覽器的
      // 計數不同步會造成 hydration mismatch
      id="gallery-curator"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: { draggable: "按空白鍵拿起，用方向鍵移動，再按空白鍵放下；按 Esc 取消。" },
      }}
    >
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5 xl:grid-cols-6">
          {order.map((id) => {
            const tile = tiles.get(id);
            if (!tile) return null;
            return (
              <SortableTile
                key={id}
                tile={tile}
                position={positions.get(id) ?? null}
                hidden={hidden.has(id)}
                featured={featured.has(id)}
                onToggleHidden={() => onToggleHidden(id)}
                onToggleFeatured={() => onToggleFeatured(id)}
              />
            );
          })}
        </ul>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(.22,1,.36,1)" }}>
        {activeTile ? (
          <TileBody
            tile={activeTile}
            position={positions.get(activeTile.id) ?? null}
            hidden={hidden.has(activeTile.id)}
            featured={featured.has(activeTile.id)}
            overlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── 首頁輪播精選：順序決定左右配對 ─────────────────────────────────

function FeaturedChip({
  tile,
  index,
  isLeftover,
  onRemove,
}: {
  tile: CuratorTile;
  index: number;
  isLeftover: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tile.id });
  const pair = Math.floor(index / 2) + 1;
  const side = index % 2 === 0 ? "左" : "右";
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex w-[76px] shrink-0 cursor-grab touch-manipulation flex-col gap-1.5 outline-none active:cursor-grabbing", isDragging && "z-10 opacity-60")}
      aria-label={`第 ${pair} 對${side}側：${tile.filename ?? "作品"}`}
      {...attributes}
      {...listeners}
    >
      <div
        className={cn(
          "relative aspect-[3/4] overflow-hidden rounded-lg bg-stone-100 ring-1",
          isLeftover ? "ring-amber-400" : "ring-stone-200",
        )}
      >
        <Image src={tile.r2Key} alt="" fill draggable={false} sizes="76px" style={{ objectFit: "cover" }} className={cn("pointer-events-none", isLeftover && "opacity-50")} />
        <button
          type="button"
          onClick={onRemove}
          onPointerDown={stop}
          onKeyDown={stop}
          aria-label="移出首頁輪播"
          className="absolute right-0.5 top-0.5 grid h-7 w-7 place-items-center rounded-md bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
        >
          <IconX size={13} />
        </button>
      </div>
      <span className={cn("text-center text-[11px] tabular-nums", isLeftover ? "text-amber-700" : "text-stone-500")}>
        {isLeftover ? "落單不使用" : `第 ${pair} 對・${side}`}
      </span>
    </li>
  );
}

export function FeaturedStrip({
  tiles,
  featured,
  onReorder,
  onRemove,
}: {
  tiles: Map<string, CuratorTile>;
  featured: string[];
  onReorder: (next: string[]) => void;
  onRemove: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const leftoverIndex = featured.length % 2 === 1 ? featured.length - 1 : -1;

  if (featured.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-stone-300 px-4 py-5 text-[13px] text-stone-500">
        <IconStar size={18} className="shrink-0 text-stone-400" />
        還沒有精選。在上面的長廊點縮圖右上角的星星，就會加進來。沒選的話，首頁會先用這個系列最前面的 4 張頂著。
      </div>
    );
  }

  return (
    <DndContext
      id="featured-strip"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(e) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        onReorder(arrayMove(featured, featured.indexOf(String(active.id)), featured.indexOf(String(over.id))));
      }}
    >
      <SortableContext items={featured} strategy={rectSortingStrategy}>
        <ul className="flex flex-wrap gap-x-2 gap-y-3">
          {featured.map((id, i) => {
            const tile = tiles.get(id);
            if (!tile) return null;
            return (
              <FeaturedChip key={id} tile={tile} index={i} isLeftover={i === leftoverIndex} onRemove={() => onRemove(id)} />
            );
          })}
        </ul>
      </SortableContext>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-stone-500">
        <IconGrip size={14} className="text-stone-400" />
        拖曳調整順序。每兩張湊成一對，首頁左右兩欄同時顯示。
        {leftoverIndex !== -1 && <span className="text-amber-700">目前是奇數張，最後一張會落單。</span>}
      </p>
    </DndContext>
  );
}
