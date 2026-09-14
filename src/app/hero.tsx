"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Lang, langFontClass } from "@/components/lang";

/**
 * 首頁 Hero——背景改成輪播（SPEC.md §4.2 沒有明確規格，這批新增的
 * 需求）。範圍刻意界定清楚：**只有背景圖片本身輪播**，姓名/輔助資訊這
 * 段文字疊層完全沿用既有結構跟三段式進場動效，不因為輪播而重新設計。
 * 進場動效跟輪播自動播放各自獨立——動效綁頁面掛載（CSS keyframes，
 * `animation-delay` 觸發），輪播綁自己的 `setInterval`，兩者不互相參照
 * 對方的狀態或時序。
 *
 * 轉場：淡入淡出（cross-fade），6 秒一輪——沒有 SPEC 明確規格，這是這批
 * 自選的合理預設，業主/設計師想調整的話這裡的 `AUTOPLAY_INTERVAL_MS`/
 * `CROSSFADE_DURATION_MS` 直接改數字即可。
 *
 * `prefers-reduced-motion`：完全停用自動播放（不是放慢），只靜態顯示
 * 第一張圖——對照 SPEC §9.2「停用所有非必要動效」，用「停用」而非「放慢」
 * 是比較保守、更貼近字面規格的解讀。
 */

export interface HeroImage {
  id: string;
  r2Key: string;
  altEn: string | null;
}

export interface HeroData {
  nameEn: string;
  nameZh: string;
  roleEn: string | null;
  roleZh: string | null;
  locationEn: string | null;
  locationZh: string | null;
  images: HeroImage[];
}

const AUTOPLAY_INTERVAL_MS = 6000;

export function Hero({ nameEn, nameZh, roleEn, roleZh, locationEn, locationZh, images }: HeroData) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [images.length]);

  const hasSupportingInfo = roleEn || roleZh || locationEn || locationZh;

  return (
    <section className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#0A0A0A]">
      {images.map((img, i) => (
        <Image
          key={img.id}
          src={img.r2Key}
          alt={img.altEn ?? ""}
          fill
          priority={i === 0}
          sizes="100vw"
          style={{ objectFit: "cover", opacity: i === index ? 1 : 0 }}
          className="transition-opacity duration-1000 ease-in-out"
        />
      ))}
      {images.length > 0 && <div className="absolute inset-0 bg-black/50" />}

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center text-[#F2F3F4]">
        {/* 第一段：水平線由左至右展開（0.8s） */}
        <div className="h-px w-40 origin-left bg-[#F2F3F4] motion-safe:scale-x-0 motion-safe:animate-[hero-line-expand_0.8s_ease-out_forwards]" />

        {/* 第二段：姓名分行由下往上滑入，逐行延遲 0.15s。用 <h1>——無障礙
            排查批次抓到的：這是全站視覺上最大、語意上也最重要的標題
            （設計師姓名），原本用 <div> 撐著，整個首頁沒有任何 <h1>，
            螢幕閱讀器使用者用標題導覽完全找不到頁面主標題。 */}
        <h1
          className="flex flex-col items-center leading-none font-normal"
          style={{ fontSize: "clamp(5rem, 14vw, 13rem)", letterSpacing: "-0.02em" }}
        >
          <span className="block overflow-hidden motion-safe:opacity-0 motion-safe:animate-[hero-slide-up_0.6s_ease-out_0.8s_forwards]">
            <span className={`lang-en block ${langFontClass("en", "display")}`}>{nameEn}</span>
          </span>
          <span className="block overflow-hidden motion-safe:opacity-0 motion-safe:animate-[hero-slide-up_0.6s_ease-out_0.95s_forwards]">
            <span className={`lang-zh block ${langFontClass("zh", "display")}`}>{nameZh}</span>
          </span>
        </h1>

        {/* 第三段：輔助資訊淡入 */}
        {hasSupportingInfo && (
          <div
            className="motion-safe:opacity-0 motion-safe:animate-[hero-fade-in_0.6s_ease-out_1.6s_forwards]"
            style={{ fontSize: "clamp(0.65rem, 1.5vw, 0.9rem)", letterSpacing: "0.1em" }}
          >
            <Lang en={roleEn ?? ""} zh={roleZh ?? ""} role="ui" />
            {(roleEn || roleZh) && (locationEn || locationZh) && <span className="mx-2 opacity-50">/</span>}
            <Lang en={locationEn ?? ""} zh={locationZh ?? ""} role="ui" />
          </div>
        )}
      </div>
    </section>
  );
}
