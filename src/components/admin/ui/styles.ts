/**
 * 後台樣式的純函式（不是 client component）——Server Component 也能直接呼叫
 * （例如用 `buttonClass()` 讓 `<Link>` 長得跟按鈕一樣）。`"use client"` 模組匯出的
 * 一般函式不能在伺服器端呼叫，所以獨立出來。
 */

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
export type ButtonSize = "sm" | "md";

export const BUTTON_BASE =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/25 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45";

export const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-stone-900 text-white shadow-sm hover:bg-stone-700",
  secondary: "border border-stone-300 bg-white text-stone-800 shadow-sm hover:border-stone-400 hover:bg-stone-50",
  ghost: "text-stone-600 hover:bg-stone-900/[0.06] hover:text-stone-900",
  danger: "border border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50",
  "danger-solid": "bg-red-600 text-white shadow-sm hover:bg-red-700",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string) {
  return cn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], extra);
}

