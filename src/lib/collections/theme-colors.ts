import type { RenderTheme } from "@/components/blocks/render/types";

/**
 * SPEC.md §4.3 的三種系列主題色。原本寫在 `block-render.tsx`（"use client"）
 * 裡，首頁的系列區塊是 Server Component，不能從 client 模組 import 常數
 * （拿到的是 client reference 代理物件，不是值），所以抽到這個 server 也能
 * 用的中性位置，`block-render.tsx` 改成從這裡取。
 */
export const THEME_COLORS: Record<RenderTheme, { bg: string; fg: string }> = {
  dark: { bg: "#0A0A0A", fg: "#E8E8E8" },
  light: { bg: "#F2F3F4", fg: "#111111" },
  void: { bg: "#000000", fg: "#FFFFFF" },
};
