"use client";

import { Button, Kbd, cn } from "./primitives";
import { useSaveShortcut, useUnsavedGuard } from "./feedback";

/**
 * 「有未儲存的變更」浮動列（業主選了「手動按儲存，但有未存提醒」）：有改東西才從底部
 * 滑上來，告訴你哪裡沒存、一鍵儲存或捨棄；⌘S / Ctrl+S 也能存；有未存變更時離開頁面
 * 會先問一聲。桌機會避開左側導覽列，手機貼底並留出瀏覽器的安全區域。
 */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  changeCount,
  saveLabel = "儲存變更",
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  changeCount?: number;
  saveLabel?: string;
}) {
  useUnsavedGuard(dirty);
  useSaveShortcut(onSave, dirty && !saving);
  const show = dirty || saving;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[transform,opacity] duration-300 ease-[cubic-bezier(.22,1,.36,1)] lg:left-64",
        show ? "translate-y-0 opacity-100" : "translate-y-[140%] opacity-0",
      )}
      aria-hidden={!show}
    >
      <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl bg-stone-900 py-2.5 pl-4 pr-2.5 text-white shadow-2xl shadow-stone-900/25">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm" role="status">
          {saving ? "儲存中…" : changeCount ? `${changeCount} 項變更尚未儲存` : "有變更尚未儲存"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-white/70 hover:bg-white/10 hover:text-white"
          onClick={onDiscard}
          disabled={saving}
          tabIndex={show ? 0 : -1}
        >
          捨棄
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="border-transparent bg-white text-stone-900 hover:bg-stone-100"
          onClick={onSave}
          loading={saving}
          tabIndex={show ? 0 : -1}
        >
          {saveLabel}
          <span className="hidden items-center gap-0.5 text-stone-400 sm:inline-flex">
            <Kbd>⌘</Kbd>
            <Kbd>S</Kbd>
          </span>
        </Button>
      </div>
    </div>
  );
}
