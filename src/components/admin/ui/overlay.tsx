"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./primitives";
import { IconX } from "./icons";

/**
 * 後台的浮層：置中對話框（`Modal`）與側邊抽屜（`Sheet`，桌機從右邊滑出、手機從
 * 底部滑上來）。共用的行為：
 * - 進出場都有轉場（`usePresence`：關閉時先播完退場動畫才卸載，不會「啪」一下消失）
 * - Esc 關閉、點背景關閉、焦點鎖在浮層裡（Tab 不會跑到背後的頁面）、關閉後焦點回到
 *   原本按的按鈕
 * - 開著的時候背後頁面不能捲動
 * - `prefers-reduced-motion` 由 globals.css 的 `.admin-root` 規則統一縮短動畫
 */

const EXIT_MS = 220;

export function usePresence(open: boolean, exitMs = EXIT_MS) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      // 下一幀才加上「顯示」狀態，進場轉場才會真的播（同一幀掛載＋顯示會直接跳到終點）
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);
  return { mounted, visible };
}

let scrollLocks = 0;
function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    if (scrollLocks === 0) {
      const scrollbar = window.innerWidth - root.clientWidth;
      root.style.overflow = "hidden";
      if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
    }
    scrollLocks += 1;
    return () => {
      scrollLocks -= 1;
      if (scrollLocks === 0) {
        root.style.overflow = "";
        root.style.paddingRight = "";
      }
    };
  }, [active]);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useFocusTrap(active: boolean, panelRef: React.RefObject<HTMLElement | null>, onEscape: () => void) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // 自動聚焦：優先 [data-autofocus]，否則第一個可聚焦元素，再不然面板本身
    const target =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    target?.focus({ preventScroll: true });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscapeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [active, panelRef]);
}

function Portal({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(document.querySelector<HTMLElement>(".admin-root") ?? document.body), []);
  return el ? createPortal(children, el) : null;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const { mounted, visible } = usePresence(open);
  const panelRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(mounted);
  useFocusTrap(open && mounted, panelRef, onClose);
  if (!mounted) return null;
  const width = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl" }[size];
  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
        <div
          className={cn(
            "absolute inset-0 bg-stone-950/40 backdrop-blur-[2px] transition-opacity duration-200",
            visible ? "opacity-100" : "opacity-0",
          )}
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === "string" ? title : undefined}
          tabIndex={-1}
          className={cn(
            "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none transition-[opacity,transform] duration-200 ease-out sm:rounded-2xl",
            width,
            visible ? "translate-y-0 opacity-100 sm:scale-100" : "translate-y-6 opacity-0 sm:translate-y-2 sm:scale-[0.97]",
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-6">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-stone-900">{title}</h2>
              {description && <p className="mt-1 text-[13px] leading-relaxed text-stone-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="關閉"
              className="-mr-2 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-900"
            >
              <IconX size={18} />
            </button>
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2 sm:px-6">{children}</div>}
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

export function Sheet({
  open,
  onClose,
  label,
  children,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  width?: "md" | "lg";
}) {
  const { mounted, visible } = usePresence(open, 280);
  const panelRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(mounted);
  useFocusTrap(open && mounted, panelRef, onClose);
  if (!mounted) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[70]">
        <div
          className={cn(
            "absolute inset-0 bg-stone-950/30 transition-opacity duration-300",
            visible ? "opacity-100" : "opacity-0",
          )}
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          className={cn(
            "absolute inset-x-0 bottom-0 flex max-h-[94dvh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]",
            "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:rounded-none md:rounded-l-2xl",
            width === "lg" ? "md:w-[min(760px,92vw)]" : "md:w-[min(520px,92vw)]",
            visible ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-x-full md:translate-y-0",
          )}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}
