"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, cn } from "./primitives";
import { IconAlert, IconCheck, IconInfo, IconX } from "./icons";
import { Modal } from "./overlay";

/**
 * 回饋層：
 * - `useToast()`：操作結果的小通知（右下角滑入、幾秒後自動消失；手機在底部置中），
 *   取代原本散落各處的「已儲存」小字與 `alert()`。`aria-live` 讓螢幕閱讀器也讀得到。
 * - `useConfirm()`：取代瀏覽器原生的 `confirm()`——原生對話框醜、會擋住整個瀏覽器、
 *   手機上更難按，而且無法說明「刪了會影響什麼」。回傳 Promise<boolean>，用法跟原生
 *   一樣直覺：`if (!(await confirm({...}))) return;`
 */

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  leaving?: boolean;
}

interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
}

const FeedbackContext = createContext<{
  toast: (tone: ToastTone, title: string, description?: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
} | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 200);
  }, []);

  const toast = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-3), { id, tone, title, description }]);
      setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3200);
    },
    [dismiss],
  );

  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...options, resolve });
        setConfirmOpen(true);
      }),
    [],
  );
  const settle = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmOpen(false);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      <div
        aria-live="polite"
        // 底部留出「未儲存」列／批次操作列的高度（約 5rem），通知不會蓋住它們的按鈕
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:items-end sm:px-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-stone-900 px-4 py-3 text-white shadow-xl shadow-stone-900/20",
              t.leaving ? "admin-toast-out" : "admin-toast-in",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full",
                t.tone === "success" && "bg-emerald-500 text-white",
                t.tone === "error" && "bg-red-500 text-white",
                t.tone === "info" && "bg-white/15 text-white",
              )}
            >
              {t.tone === "success" ? <IconCheck size={13} strokeWidth={2.4} /> : t.tone === "error" ? <IconAlert size={12} strokeWidth={2.2} /> : <IconInfo size={13} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[13px] leading-relaxed text-white/70">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="關閉通知"
              className="-mr-1 grid h-6 w-6 shrink-0 place-items-center rounded text-white/50 transition-colors hover:text-white"
            >
              <IconX size={14} />
            </button>
          </div>
        ))}
      </div>
      <Modal
        open={confirmOpen}
        onClose={() => settle(false)}
        size="sm"
        title={confirmState?.title ?? ""}
        description={confirmState?.description}
        footer={
          <>
            <Button variant="secondary" onClick={() => settle(false)}>
              {confirmState?.cancelLabel ?? "取消"}
            </Button>
            <Button
              variant={confirmState?.tone === "danger" ? "danger-solid" : "primary"}
              onClick={() => settle(true)}
              data-autofocus
            >
              {confirmState?.confirmLabel ?? "確定"}
            </Button>
          </>
        }
      />
    </FeedbackContext.Provider>
  );
}

function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useToast/useConfirm 必須放在 <FeedbackProvider> 裡");
  return ctx;
}

export function useToast() {
  return useFeedback().toast;
}

export function useConfirm() {
  return useFeedback().confirm;
}

/** 有東西還沒存時：關分頁/重新整理會跳瀏覽器原生提醒；點後台內的連結會跳我們自己的確認框。 */
export function useUnsavedGuard(dirty: boolean) {
  const confirm = useConfirm();
  const router = useRouter();
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    // capture 階段攔截，比 Next.js <Link> 的 React 事件更早——這樣才能在換頁前先問
    async function onClick(e: MouseEvent) {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return;
      e.preventDefault();
      e.stopPropagation();
      const leave = await confirm({
        title: "有變更還沒儲存",
        description: "離開這一頁的話，剛剛的修改會不見。",
        confirmLabel: "不儲存，直接離開",
        cancelLabel: "留在這裡",
        tone: "danger",
      });
      if (leave) {
        // 用前端換頁（不是整頁重新載入），不然 beforeunload 會再跳一次瀏覽器原生提醒
        dirtyRef.current = false;
        router.push(url.pathname + url.search + url.hash);
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [confirm, router]);
}

/** ⌘S / Ctrl+S 存檔（攔掉瀏覽器「另存網頁」）。 */
export function useSaveShortcut(onSave: () => void, enabled: boolean) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (enabled) onSaveRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
