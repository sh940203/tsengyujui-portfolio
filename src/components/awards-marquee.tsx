"use client";

import { useEffect, useRef, useState } from "react";
import { Lang, langFontClass } from "@/components/lang";

/**
 * 獲獎經歷跑馬燈——**首頁專用**（2026-09-24 從關於頁搬過來，見下方「搬家」說明）。
 *
 * 版面：整條反相色帶（底色 `--ui-fg`、文字 `--ui-bg`，所以右上角淺色/深色切換時
 * 跟著對調，跟首頁系列區塊黑白交替的節奏一致）。每筆獎項 = 年份（小）＋獎項名稱
 * （巨大字級）＋成績（外框小標籤）＋一條細線分隔。
 *
 * **搬家**：原本裝在關於頁「往下第一節」，業主看過後回饋兩件事——(1) 這個跑馬燈
 * 效果想放在首頁（中段或尾段皆可），(2) 關於頁本身要能「一目瞭然」，不要動態
 * 效果。所以現在裝在首頁 `SeriesSections`／`BioSection` 之後、頁尾之前（見
 * `src/app/page.tsx`），關於頁改用純靜態、可直接掃視的清單（`about-sections.tsx`
 * 的 `AwardsList`）。元件本身（跑馬燈邏輯、暫停鈕、`prefers-reduced-motion` 降級）
 * 完全沒變，純粹換了掛載位置，搬到 `src/components/` 這個共用位置。
 *
 * 動效（全部是使用者動作的回饋，不是載入時的自動表演——SPEC §4.2）：
 * - 基礎速度往左緩緩移動；
 * - 捲動速度會帶動它加速：往下捲越快跑越快，往上捲快速時會**減速到接近停止**，
 *   但不會反向倒退（第一版會反向，快速往上捲時文字忽然倒著跑，實測起來像是
 *   壞掉而不是設計——已把 boost 的下限夾在 `-BASE_SPEED`，速度只會趨近 0，
 *   不會變號）；放開/停止捲動後平順回到基礎速度；
 * - **顯式的暫停/播放按鈕**（2026-09-24 補上，業主回報「UI/UX 體驗不好」後
 *   重新稽核抓到的根因）：原本只有滑鼠 hover 能暫停，觸控裝置完全沒有
 *   hover，等於手機使用者永遠只能「追著」持續移動的文字讀——對獎項這種
 *   使用者可能想看清楚的資訊，這是真正的可用性缺陷，也不符合 WCAG 2.2.2
 *   （自動、持續超過 5 秒的移動內容，必須提供使用者可操作的暫停機制，
 *   不能只靠作業系統的「減少動態」設定）。按鈕跟站內既有的語言/主題切換鈕
 *   同一個視覺語彙（極小、外框、圖示＋`aria-label`/`title`），滑鼠/觸控/
 *   鍵盤（Tab + Enter/Space，原生 `<button>`）都能用。減少動態時版面已經
 *   是靜態清單、沒有東西好暫停，按鈕不渲染。
 * - 滑鼠移上去暫停，並把其他獎項淡下去、只留指到的那一筆（跟 Cumedy 拼貼的懸停一致）；
 *   觸控裝置沒有 hover，不受影響——現在有上面的按鈕頂著，不是唯一的暫停手段；
 * - 畫面外不跑（`IntersectionObserver`），`prefers-reduced-motion` 時完全不動，
 *   版面改成靜態清單（每筆獎項一列、標題可換行），內容一樣看得到。
 *
 * 只動 `transform`（單一元素、不觸發版面重排）。無障礙：第一組是真正的 `<ul>`，
 * 拼接用的複本（第二組、以及獎項太少時為了填滿寬度的重複項）全部 `aria-hidden`，
 * 螢幕閱讀器只會讀到每筆獎項一次。
 */

export interface MarqueeAward {
  id: string;
  year: string;
  titleEn: string | null;
  titleZh: string | null;
  resultEn: string | null;
  resultZh: string | null;
}

/**
 * 基礎速度（px/秒，往左）。原本 56（2026-09-24 定案），業主 2026-09-28 看過
 * 正式站後回饋「跑馬燈速度再快一點」，調到 92（約 1.6 倍）。
 */
const BASE_SPEED = 92;
/** 捲動速度 → 額外速度的增益，與速度上限（px/秒）。 */
const SCROLL_GAIN = 0.55;
const MAX_BOOST = 900;

/**
 * 官方英文譯名待補的獎項（`titleEn` 為 `null`）不用雙語主從機制去湊——硬塞進 `Lang`
 * 會讓同一段中文一大一小疊兩次。缺英文版就直接顯示中文原文一次，不管目前是哪個語言
 * 模式（同 HANDOFF 一直以來的規則，不編造英譯）。中文字面積比拉丁字大，縮到 0.8em
 * 才跟英文獎項的視覺重量一致。
 */
function AwardTitle({ titleEn, titleZh }: { titleEn: string | null; titleZh: string | null }) {
  if (titleEn) {
    return <Lang en={titleEn} zh={titleZh ?? ""} role="display" className="lang-pair" />;
  }
  return (
    <span className={langFontClass("zh", "display")} style={{ fontSize: "0.8em", fontWeight: 500 }}>
      {titleZh}
    </span>
  );
}

function AwardResult({ resultEn, resultZh }: { resultEn: string | null; resultZh: string | null }) {
  if (!resultEn && !resultZh) return null;
  return (
    <span
      className="lang-readable inline-flex shrink-0 items-center rounded-full border border-current px-[clamp(0.9rem,1.6vw,1.5rem)] py-[clamp(0.35rem,0.7vw,0.6rem)]"
      style={{ fontSize: "clamp(0.8rem, 1.25vw, 1.15rem)", letterSpacing: "0.14em" }}
    >
      {resultEn ? (
        <Lang en={resultEn} zh={resultZh ?? ""} role="ui" />
      ) : (
        <span className={langFontClass("zh", "ui")}>{resultZh}</span>
      )}
    </span>
  );
}

function AwardItem({ award, decorative }: { award: MarqueeAward; decorative: boolean }) {
  return (
    <li
      aria-hidden={decorative || undefined}
      className="award-item flex shrink-0 items-center gap-[clamp(1.25rem,2.6vw,2.5rem)] pr-[clamp(1.25rem,2.6vw,2.5rem)] motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:gap-y-3 motion-reduce:pr-0"
    >
      <span
        className={`self-start pt-[0.6em] ${langFontClass("en", "ui")}`}
        style={{ fontSize: "clamp(0.8rem, 1.1vw, 1rem)", letterSpacing: "0.18em" }}
      >
        {award.year}
      </span>
      {/* 減少動態時不再是單行無限延伸的色帶，而是每筆獎項各佔一列的靜態清單：字級縮小、標題可換行 */}
      <span
        className="min-w-0 text-[clamp(2.75rem,8vw,8rem)] leading-none motion-reduce:text-[clamp(1.75rem,4.5vw,4rem)] motion-reduce:leading-tight"
        style={{ letterSpacing: "-0.02em" }}
      >
        <AwardTitle titleEn={award.titleEn} titleZh={award.titleZh} />
      </span>
      <AwardResult resultEn={award.resultEn} resultZh={award.resultZh} />
      <span aria-hidden="true" className="block h-px w-[clamp(2.5rem,6vw,6rem)] shrink-0 bg-current opacity-40 motion-reduce:hidden" />
    </li>
  );
}

/** 「2023–2026」；同一年就只寫一個年份；年份不是數字的資料（理論上不會）就不顯示。 */
function yearRange(awards: MarqueeAward[]): string | null {
  const years = awards.map((a) => Number.parseInt(a.year, 10)).filter((y) => Number.isFinite(y));
  if (years.length === 0) return null;
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min}–${max}`;
}

export function AwardsMarquee({ awards }: { awards: MarqueeAward[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLUListElement>(null);
  /** 1 = 正常、0 = 暫停（滑鼠停在色帶上，或按了暫停鈕）；動畫迴圈每幀朝它靠近，所以暫停/恢復是平順的。 */
  const hoverTarget = useRef(1);
  /** 暫停鈕的狀態——用 ref 給動畫迴圈讀（避免每次點擊都要重新掛載 effect），用 state 讓按鈕圖示重新渲染。 */
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  /** 減少動態時版面已經是靜態清單，沒有東西好暫停，不渲染按鈕。 */
  const [reducedMotion, setReducedMotion] = useState(false);

  // 獎項少時，單組寬度可能比視窗窄、拼接處會露出空白：重複到至少 4 筆再當作一組
  const repeat = Math.max(1, Math.ceil(4 / Math.max(1, awards.length)));
  const range = yearRange(awards);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    const group = groupRef.current;
    if (!section || !track || !group) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let running = false;
    let visible = false;
    let offset = 0;
    let hover = 1;
    let boost = 0;
    let last = 0;
    let lastScrollY = 0;
    let groupWidth = group.getBoundingClientRect().width;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const y = window.scrollY;
      const scrollVelocity = dt > 0 ? (y - lastScrollY) / dt : 0;
      lastScrollY = y;

      // 下限夾在 -BASE_SPEED（不是 -MAX_BOOST）：往上快速捲時最多讓速度趨近 0，
      // 不會變成負的讓跑馬燈反向倒退（第一版會反向，實測起來像壞掉，見上方說明）。
      const target = Math.max(-BASE_SPEED, Math.min(MAX_BOOST, scrollVelocity * SCROLL_GAIN));
      boost += (target - boost) * Math.min(1, dt * 7);
      const hoverGoal = pausedRef.current ? 0 : hoverTarget.current;
      hover += (hoverGoal - hover) * Math.min(1, dt * 6);

      offset += (BASE_SPEED + boost) * hover * dt;
      if (groupWidth > 0) offset = ((offset % groupWidth) + groupWidth) % groupWidth;
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
      raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      const shouldRun = visible && !reduced.matches;
      if (shouldRun && !running) {
        running = true;
        last = performance.now();
        lastScrollY = window.scrollY;
        raf = requestAnimationFrame(frame);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
      // 減少動態：回到靜態排列（CSS 的 `motion-reduce:` 接手版面），不留殘餘位移
      if (reduced.matches) {
        offset = 0;
        track.style.transform = "";
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { rootMargin: "80px 0px" },
    );
    io.observe(section);
    const ro = new ResizeObserver(() => {
      groupWidth = group.getBoundingClientRect().width;
    });
    ro.observe(group);
    reduced.addEventListener("change", sync);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      reduced.removeEventListener("change", sync);
    };
  }, []);

  if (awards.length === 0) return null;

  const items = Array.from({ length: repeat }, (_, r) => awards.map((award) => ({ award, r }))).flat();

  return (
    <section
      id="awards"
      ref={sectionRef}
      className="award-marquee overflow-hidden bg-[var(--ui-fg)] py-[clamp(4rem,9vw,8rem)] text-[var(--ui-bg)]"
    >
      <div className="mx-auto mb-[clamp(2.5rem,6vw,5rem)] flex max-w-[90rem] items-start justify-between gap-6 px-6 lg:px-16">
        <div>
          <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", letterSpacing: "-0.01em" }}>
            <Lang en="Awards" zh="獲獎經歷" role="display" className="series-title-lang" />
          </h2>
          <p className="lang-readable mt-4 max-w-xl" style={{ fontSize: "0.95rem", lineHeight: 1.7 }}>
            <Lang
              en={`${awards.length} awards${range ? `, ${range}` : ""}.`}
              zh={`${range ? `${range} 年，` : ""}共 ${awards.length} 個獎項。`}
              role="ui"
              className="series-title-lang"
            />
          </p>
        </div>
        {/* 顯式暫停/播放——滑鼠、觸控、鍵盤都能用，不是只靠 hover（WCAG 2.2.2）。
            減少動態時版面已是靜態清單，沒有東西好暫停，不渲染。 */}
        {!reducedMotion && (
          <button
            type="button"
            onClick={() => {
              pausedRef.current = !pausedRef.current;
              setPaused(pausedRef.current);
            }}
            aria-label={paused ? "Play marquee / 播放跑馬燈" : "Pause marquee / 暫停跑馬燈"}
            title={paused ? "播放 / Play" : "暫停 / Pause"}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded border border-current"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              {paused ? <path d="M8 5v14l11-7z" /> : <path d="M7 5h4v14H7zM13 5h4v14h-4z" />}
            </svg>
          </button>
        )}
      </div>

      <div
        className="border-y border-current/20 py-[clamp(1.75rem,4vw,3.5rem)] motion-reduce:overflow-visible"
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") hoverTarget.current = 0;
        }}
        onPointerLeave={() => {
          hoverTarget.current = 1;
        }}
      >
        <div ref={trackRef} className="flex w-max will-change-transform motion-reduce:w-full motion-reduce:px-6 lg:motion-reduce:px-16">
          <ul ref={groupRef} className="flex shrink-0 motion-reduce:min-w-0 motion-reduce:flex-1 motion-reduce:shrink motion-reduce:flex-wrap motion-reduce:gap-y-8">
            {items.map(({ award, r }) => (
              <AwardItem key={`${award.id}-${r}`} award={award} decorative={r > 0} />
            ))}
          </ul>
          {/* 拼接用的複本：跟第一組一模一樣、對輔助技術隱藏；減少動態時整組不顯示 */}
          <ul aria-hidden="true" className="flex shrink-0 motion-reduce:hidden">
            {items.map(({ award, r }) => (
              <AwardItem key={`dup-${award.id}-${r}`} award={award} decorative />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
