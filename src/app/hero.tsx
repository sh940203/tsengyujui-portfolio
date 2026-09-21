"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { heroEnFont, heroZhFont } from "./hero-fonts";
import { NAME_LOGOTYPE, type Logotype } from "@/lib/brand/name-logotype";

/**
 * 首頁 Hero——2026-09-18 再次改版：業主指定參考 aoiofficial.com 首頁，
 * 左右兩欄「同時」輪播（上一版是左欄純文字面板、只有右欄輪播），且業主
 * 明講「左右的照片要是同系列的」——兩欄由同一個 `index` 驅動，各自顯示
 * 同一個 `HeroPair` 的 `left`/`right`，配對邏輯在後端
 * `src/lib/media/featured.ts` 的 `getHomeCarouselPairs()`（只有兩張以上
 * 精選/fallback 圖片的系列才湊得成對，湊不出來的系列直接跳過，不會出現
 * 在輪播裡——這條規則是業主明講的，不是工程端自己選的折衷）。
 *
 * 文字疊層：姓名/職稱不再坐在獨立的純色面板，改成疊在左欄圖片上、靠左
 * 對齊，用 `mix-blend-mode: overlay` 做出「跟著背景半透明」的效果（業主
 * 提供的參考截圖是文字融進背景照片，不是純粹的白字疊圖）。字體目前先用
 * 站上既有的 Inter Tight（SPEC §5.2 的 display 字體）——這批只是套用
 * 混合模式本身，字體家族要不要換是業主另外決定的事，見這次對話裡列出的
 * 候選字體建議。
 *
 * 轉場：沿用上一版的「模糊快閃」`@keyframes`（`globals.css` 的
 * `hero-flicker-enter`/`hero-flicker-exit`），左右兩欄各自獨立掛載自己的
 * enter/exit 圖層，但共用同一個 `index`/`prevIndex` 狀態，兩欄的轉場永遠
 * 同時觸發、同時完成——不是各自獨立的計時器，這樣才能保證任何時刻左右
 * 兩張圖都屬於同一個 `pairs[index]`。
 */

export interface HeroImage {
  id: string;
  r2Key: string;
  altEn: string | null;
}

export interface HeroPair {
  left: HeroImage;
  right: HeroImage;
}

export interface HeroData {
  nameEn: string;
  nameZh: string;
  roleEn: string | null;
  roleZh: string | null;
  locationEn: string | null;
  locationZh: string | null;
  pairs: HeroPair[];
}

const AUTOPLAY_INTERVAL_MS = 6000;

/** 左右兩欄共用的單一輪播欄——只負責顯示自己那一路的模糊快閃轉場。 */
function HeroCarouselColumn({
  images,
  index,
  prevIndex,
}: {
  images: HeroImage[];
  index: number;
  prevIndex: number | null;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0A0A0A]">
      {images.map((img, i) => {
        const isCurrent = i === index;
        const isPrev = i === prevIndex;
        if (!isCurrent && !isPrev) return null;

        return (
          <Image
            key={`${img.id}-${isCurrent ? `enter-${index}` : `exit-${prevIndex}`}`}
            src={img.r2Key}
            alt={img.altEn ?? ""}
            fill
            priority={i === 0}
            sizes="(max-width: 1024px) 100vw, 50vw"
            style={{ objectFit: "cover", zIndex: isCurrent ? 2 : 1 }}
            className={
              isCurrent
                ? "motion-safe:animate-[hero-flicker-enter_0.6s_ease-out_forwards]"
                : "motion-safe:animate-[hero-flicker-exit_0.5s_ease-in_forwards]"
            }
          />
        );
      })}
    </div>
  );
}

/** Hero 專用的雙語文字——跟 `Lang` 一樣同時渲染 en/zh，但字體用 Hero 專屬的兩款。 */
function HeroLang({ en, zh }: { en: string; zh: string }) {
  return (
    <span>
      {en && <span className="lang-en font-[family-name:var(--font-hero-en)]">{en}</span>}
      {zh && <span className="lang-zh font-[family-name:var(--font-hero-zh)]">{zh}</span>}
    </span>
  );
}

/**
 * 姓名單行。有專屬字樣（`src/lib/brand/name-logotype.ts`）就顯示字樣圖，同時把真實姓名文字
 * 以視覺隱藏（`sr-only`）的形式留在 DOM 裡——搜尋引擎、螢幕閱讀器、`<h1>` 的
 * 語意都靠這段文字，圖片只是視覺（`alt=""` + `aria-hidden`）。沒有字樣就直接
 * 顯示文字。
 *
 * 字樣圖用 `filter: brightness(0) invert(1)` 統一轉成白色：外層 `difference`
 * 混合需要白色才有反相效果（黑色會整個消失），這樣設計師給什麼顏色的去背圖
 * 都能用。高度用 `em`，讓語言切換時（globals.css 把次要語言縮成 0.55em）字樣
 * 跟著縮放，跟文字版的行為一致。
 */
function HeroNameLine({ lang, text, logotype }: { lang: "en" | "zh"; text: string; logotype: Logotype | null }) {
  const langClass = lang === "en" ? "lang-en" : "lang-zh";
  if (!logotype) {
    const fontClass =
      lang === "en" ? "font-[family-name:var(--font-hero-en)]" : "font-[family-name:var(--font-hero-zh)]";
    return <span className={`${langClass} block font-bold ${fontClass}`}>{text}</span>;
  }
  return (
    <span className={`${langClass} block`}>
      <span className="sr-only">{text}</span>
      {/* 靜態 SVG/PNG（放在 public/brand/），不走全站的 R2 自訂圖片 loader。 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logotype.src}
        alt=""
        aria-hidden="true"
        className="block h-auto"
        style={{
          // 以寬度為準、超出欄位就縮小（不是固定高度）：字樣加大後在較窄的視窗
          // 不會超出左欄。`100%` 要有意義，外層的 h1 與每行 span 都要撐滿欄寬。
          width: `min(100%, ${logotype.aspect * logotype.heightEm}em)`,
          aspectRatio: logotype.aspect,
          filter: "brightness(0) invert(1)",
        }}
      />
    </span>
  );
}

export function Hero({ nameEn, nameZh, roleEn, roleZh, locationEn, locationZh, pairs }: HeroData) {
  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    if (pairs.length <= 1) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const timer = setInterval(() => {
      const current = indexRef.current;
      const next = (current + 1) % pairs.length;
      setPrevIndex(current);
      setIndex(next);
      indexRef.current = next;
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pairs.length]);

  const hasSupportingInfo = roleEn || roleZh || locationEn || locationZh;
  const leftImages = pairs.map((p) => p.left);
  const rightImages = pairs.map((p) => p.right);

  return (
    <section className={`relative flex w-full flex-col lg:h-screen lg:flex-row ${heroEnFont.variable} ${heroZhFont.variable}`}>
      <div className="relative h-[45vh] w-full lg:h-screen lg:w-1/2">
        <HeroCarouselColumn images={leftImages} index={index} prevIndex={prevIndex} />
        {/* 文字疊層：絕對定位貼在左欄上方，靠左對齊。`mix-blend-mode:
            difference` 讓白字跟底下的照片反相混合——亮處變黑字、暗處變白字，
            在混亂背景上也讀得到（原本的 `overlay` 在白色/深色區域都幾乎
            消失，業主看過比較後選定 difference）。 */}
        <div
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-start justify-center gap-8 px-6 text-left lg:px-16"
          style={{ mixBlendMode: "difference" }}
        >
          {/* 第一段：水平線由左至右展開（0.8s） */}
          <div className="h-px w-40 origin-left bg-white motion-safe:scale-x-0 motion-safe:animate-[hero-line-expand_0.8s_ease-out_forwards]" />

          {/* 第二段：姓名分行由下往上滑入，逐行延遲 0.15s。每一行外層的
              `overflow-hidden` 是滑入動畫的遮罩，但行高 `leading-none` 放不下
              下伸部（g、y 的尾巴會被切掉），所以上下各補 0.12em 的 padding，
              再用等量負 margin 抵銷，視覺行距不變。 */}
          <h1
            className="flex w-full flex-col items-start leading-none"
            style={{ fontSize: "clamp(3rem, 5.2vw, 7rem)", letterSpacing: "-0.02em", color: "white" }}
          >
            <span className="-my-[0.12em] block w-full overflow-hidden py-[0.12em] motion-safe:opacity-0 motion-safe:animate-[hero-slide-up_0.6s_ease-out_0.8s_forwards]">
              <HeroNameLine lang="en" text={nameEn} logotype={NAME_LOGOTYPE.en} />
            </span>
            <span className="-my-[0.12em] block w-full overflow-hidden py-[0.12em] motion-safe:opacity-0 motion-safe:animate-[hero-slide-up_0.6s_ease-out_0.95s_forwards]">
              <HeroNameLine lang="zh" text={nameZh} logotype={NAME_LOGOTYPE.zh} />
            </span>
          </h1>

          {/* 第三段：輔助資訊淡入 */}
          {hasSupportingInfo && (
            <div
              className="motion-safe:opacity-0 motion-safe:animate-[hero-fade-in_0.6s_ease-out_1.6s_forwards]"
              style={{ fontSize: "clamp(0.8rem, 1.4vw, 1.1rem)", letterSpacing: "0.08em", color: "white" }}
            >
              <HeroLang en={roleEn ?? ""} zh={roleZh ?? ""} />
              {(roleEn || roleZh) && (locationEn || locationZh) && <span className="mx-2 opacity-50">/</span>}
              <HeroLang en={locationEn ?? ""} zh={locationZh ?? ""} />
            </div>
          )}
        </div>
      </div>
      <div className="relative h-[45vh] w-full lg:h-screen lg:w-1/2">
        <HeroCarouselColumn images={rightImages} index={index} prevIndex={prevIndex} />
      </div>
    </section>
  );
}
