"use client";

import Link from "next/link";
import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { IconChevronDown, IconChevronLeft } from "./icons";

/**
 * 後台共用的基礎元件（2026-10-22 後台改版）。後台不受 SPEC §5 前台視覺系統約束，
 * 走「安靜、精緻、好操作」的方向：石墨灰階（Tailwind `stone`）、白色卡片、
 * 黑色主要按鈕、清楚的焦點框與按壓回饋。所有互動元件的觸控熱區 ≥ 40px。
 */

export { buttonClass, cn } from "./styles";
import { BUTTON_BASE, BUTTON_VARIANT, buttonClass, cn, type ButtonSize, type ButtonVariant } from "./styles";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    icon?: ReactNode;
  }
>(function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, type, ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {loading ? <Spinner size={size === "sm" ? 14 : 16} /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: ButtonVariant; size?: "sm" | "md" }
>(function IconButton({ label, variant = "ghost", size = "md", className, children, type, ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-label={label}
      title={label}
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANT[variant],
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        "px-0",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn("animate-spin", className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Badge ─────────────────────────────────────────────────────────

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue" | "dark";
const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-stone-100 text-stone-600 ring-stone-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  dark: "bg-stone-900 text-white ring-stone-900",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        BADGE_TONE[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-white/25 px-1 font-sans text-[11px] leading-none opacity-80">
      {children}
    </kbd>
  );
}

// ── Page / Section ────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  back,
  actions,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-3 inline-flex h-8 items-center gap-1 rounded-lg pr-2 text-[13px] text-stone-500 transition-colors hover:text-stone-900"
          >
            <IconChevronLeft size={16} />
            {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-[28px]">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  id,
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)]",
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex flex-col gap-3 border-b border-stone-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-stone-900">{title}</h2>}
            {description && <p className="mt-1 text-[13px] leading-relaxed text-stone-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("px-5 py-5 sm:px-6", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-14 text-center">
      {icon && <div className="grid h-12 w-12 place-items-center rounded-full bg-stone-100 text-stone-500">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-stone-800">{title}</p>
        {description && <p className="mt-1 text-[13px] text-stone-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Fields ────────────────────────────────────────────────────────

const CONTROL =
  "w-full rounded-lg border border-stone-300 bg-white text-sm text-stone-900 shadow-[0_1px_0_rgba(28,25,23,0.03)] outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-stone-400 hover:border-stone-400 focus:border-stone-900 focus:ring-4 focus:ring-stone-900/[0.07] disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400";

export function Field({
  label,
  hint,
  error,
  changed,
  counter,
  htmlFor,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** 這個欄位跟已儲存的版本不同（顯示小圓點，讓人知道「這裡改過、還沒存」）。 */
  changed?: boolean;
  counter?: { value: number; max: number };
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="flex items-center gap-2 text-[13px] font-medium text-stone-800">
          {label}
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full bg-amber-500 transition-[opacity,transform] duration-200",
              changed ? "scale-100 opacity-100" : "scale-0 opacity-0",
            )}
            aria-hidden="true"
          />
          {changed && <span className="sr-only">（已修改，尚未儲存）</span>}
        </label>
        {counter && (
          <span
            className={cn(
              "text-[11px] tabular-nums",
              counter.value > counter.max ? "text-red-600" : "text-stone-400",
            )}
          >
            {counter.value} / {counter.max}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="text-xs leading-relaxed text-stone-500">{hint}</p>
      )}
    </div>
  );
}

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode; invalid?: boolean }
>(function TextInput({ className, leading, invalid, ...props }, ref) {
  if (leading) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-400">
          {leading}
        </span>
        <input
          ref={ref}
          className={cn(CONTROL, "h-10 pl-8 pr-3", invalid && "border-red-400 focus:border-red-500 focus:ring-red-500/10", className)}
          {...props}
        />
      </div>
    );
  }
  return (
    <input
      ref={ref}
      className={cn(CONTROL, "h-10 px-3", invalid && "border-red-400 focus:border-red-500 focus:ring-red-500/10", className)}
      {...props}
    />
  );
});

/** 會跟著內容自動長高的多行輸入框（敘述、簡介這種長文字不用在小框框裡捲）。 */
export function TextArea({
  className,
  minRows = 3,
  value,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      className={cn(CONTROL, "resize-none px-3 py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(CONTROL, "h-10 cursor-pointer appearance-none pl-3 pr-9", className)} {...props}>
        {children}
      </select>
      <IconChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"
      />
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-[13px] font-medium text-stone-800">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/25 focus-visible:ring-offset-2 disabled:opacity-45",
          checked ? "bg-stone-900" : "bg-stone-300",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(.3,1.4,.5,1)]",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
}

/** 二到四個選項的單選（取代原生下拉選單：選項一眼看得到，不用點開才知道有什麼）。 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = "md",
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  ariaLabel: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-stone-100 p-1"
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const i = options.findIndex((o) => o.value === value);
        const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
        onChange(next.value);
        const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
        buttons[options.indexOf(next)]?.focus();
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg px-3 font-medium transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/25",
              size === "sm" ? "h-8 text-[13px]" : "h-9 text-sm",
              selected ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("admin-shimmer rounded-lg bg-stone-200/70", className)} />;
}
