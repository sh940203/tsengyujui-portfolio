"use client";

import { useEffect, useState } from "react";
import { Lang } from "@/components/lang";

/**
 * 「往下瀏覽」提示：一條細線裡有一段亮線由上往下滑，往下捲一點就淡出（提示完成任務）。
 * 跟首頁 Hero 底部那顆同一個語彙（`scroll-cue` keyframes 在 `globals.css`），差別是
 * 這裡放在一般底色上，顏色取 `currentColor`，不需要半透明黑底卡片。
 * 手機空間不夠，只留動畫線條；桌機才帶文字。
 */
export function ScrollCue({ href }: { href: string }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <a
      href={href}
      aria-label="Scroll to explore / 往下瀏覽"
      className={`flex min-h-11 shrink-0 items-center gap-3 transition-opacity duration-500 ${
        scrolled ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ fontSize: "0.7rem", letterSpacing: "0.18em" }}
    >
      <span className="hidden lg:inline">
        <Lang en="Scroll to explore" zh="往下瀏覽" role="ui" className="lang-pair" />
      </span>
      <span className="relative block h-7 w-px overflow-hidden bg-current/30" aria-hidden="true">
        <span className="absolute inset-x-0 top-0 block h-1/2 bg-current motion-safe:animate-[scroll-cue_1.8s_ease-in-out_infinite]" />
      </span>
    </a>
  );
}
