"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { AdjacentCollectionLink, RenderTheme } from "@/components/blocks/render/types";
import { Lang, langFontClass, langFontVariables } from "@/components/lang";
import { KIND_LABEL, type GalleryStyle } from "@/lib/collections/gallery-style";
import type { GalleryItem } from "@/lib/collections/get-series-gallery";
import { THEME_COLORS } from "@/lib/collections/theme-colors";

/**
 * 系列內頁（2026-09-20 改版）：桌機左欄固定（標題、完整雙語敘述、目前第幾件
 * 的計數與進度）、右欄捲動系列**全部作品**；手機上下堆疊，敘述預設收合。
 * 三個系列邏輯相同、右欄節奏不同（見 `gallery-style.ts`）：
 *
 * - flash（Cumedy Night）：兩欄緊貼的拼貼，圖片微傾斜、互相壓住；每張進場像
 *   閃燈（亮度瞬間爆高再硬切）；滑鼠移到某張它跳到最前面、其餘變暗。
 * - still（淨土）：一屏一件、留白極大、緩慢浮現；左欄敘述隨捲動一行一行亮起。
 * - venom（X-venom）「感染擴散」：作品全程清楚可見，但越往後圖的邊緣被咬出越深
 *   的鋸齒（尖刺）、鏽紅/軍綠的噴漆斑點越來越密、捲得越快圖抖得越厲害（神經
 *   失控）；左欄敘述行距逐句縮小、出現鏽紅色重影。
 *
 * 進度 `--p`（0→1）用 CSS 變數直接寫在根元素上，不走 React state，避免每次
 * 捲動都重新渲染整個長廊；只有「目前第幾件」這種真的會改變文字的東西才用
 * state（而且只在數值改變時才更新）。
 */

const ACCENT: Record<GalleryStyle, string> = {
  flash: "#D4213D", // Cumedy Night 的簽名紅（口紅、絲襪）
  still: "currentColor",
  venom: "#B03A20", // X-venom 的鏽紅
};

const META_STYLE = { fontSize: "0.7rem", letterSpacing: "0.18em" } as const;

/** 確定性的偽隨機（−1~1）：同一張圖每次渲染的傾斜/位移都一樣，不會 SSR/CSR 不一致。 */
function chaos(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 追蹤捲動：更新根元素的 `--p`（整個長廊的捲動進度）並回傳「最接近視窗中線的
 * 那一件」的序號。直接在 scroll 事件裡算、不用 `requestAnimationFrame`——
 * 只做讀取（最多 48 個 `getBoundingClientRect`），沒有寫入版面的動作。
 */
function useGalleryTracking(
  rootRef: RefObject<HTMLElement | null>,
  galleryRef: RefObject<HTMLElement | null>,
  count: number,
) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const root = rootRef.current;
    const gallery = galleryRef.current;
    if (!root || !gallery) return;
    let last = -1;
    const update = () => {
      const rect = gallery.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      root.style.setProperty("--p", p.toFixed(3));

      const mid = window.innerHeight / 2;
      let best = 0;
      let bestDist = Infinity;
      gallery.querySelectorAll<HTMLElement>("[data-gallery-item]").forEach((el) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDist) {
          bestDist = d;
          best = Number(el.dataset.galleryItem);
        }
      });
      if (best !== last) {
        last = best;
        setActive(best);
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [rootRef, galleryRef, count]);
  return active;
}

/**
 * 進場：沒有 `data-reveal` 屬性 = 伺服器端輸出（完全可見，沒 JS 也看得到作品）；
 * 掛載後如果已經在畫面內就直接 `in`，否則先 `hidden`、捲進來才 `in`。
 * 動畫本身在 `globals.css`，`prefers-reduced-motion` 一律直接顯示。
 */
function Reveal({
  index,
  className,
  style,
  children,
}: {
  index: number;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"ssr" | "hidden" | "in">("ssr");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.95 && r.bottom > 0) {
      setPhase("in");
      return;
    }
    setPhase("hidden");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPhase("in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      data-gallery-item={index}
      data-reveal={phase === "ssr" ? undefined : phase}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}

function GalleryImage({
  item,
  alt,
  sizes,
  priority,
}: {
  item: GalleryItem;
  alt: string;
  sizes: string;
  priority: boolean;
}) {
  return <Image src={item.r2Key} alt={alt} fill sizes={sizes} priority={priority} style={{ objectFit: "cover" }} />;
}

interface GalleryProps {
  items: GalleryItem[];
  altFor: (item: GalleryItem, index: number) => string;
}

/** Cumedy Night：兩欄依「哪一欄目前比較矮就放哪一欄」分配，緊貼、微傾斜、互相壓住。 */
function FlashGallery({ items, altFor }: GalleryProps) {
  const columns = useMemo(() => {
    const cols: { item: GalleryItem; index: number }[][] = [[], []];
    const heights = [0, 0.3]; // 第二欄起點往下錯開
    items.forEach((item, index) => {
      const c = heights[0] <= heights[1] ? 0 : 1;
      cols[c].push({ item, index });
      heights[c] += (1 / item.aspect) * (item.kind === "sketch" ? 0.72 : 1);
    });
    return cols;
  }, [items]);

  return (
    <div className="gallery-flash-grid flex items-start gap-[6px] px-[6px] pb-[10vh] pt-[6px] lg:gap-2 lg:px-2">
      {columns.map((col, ci) => (
        <div key={ci} className="flex min-w-0 flex-1 flex-col" style={{ marginTop: ci === 1 ? "12vh" : 0 }}>
          {col.map(({ item, index }, k) => {
            const r = chaos(index + 1);
            const r2 = chaos(index + 101);
            const sketch = item.kind === "sketch";
            return (
              <Reveal
                key={item.id}
                index={index}
                className="gallery-flash gallery-flash-item relative"
                style={
                  {
                    "--r": `${(sketch ? r * 3.2 : r * 1.3).toFixed(2)}deg`,
                    "--x": `${(r2 * 1.2).toFixed(2)}vw`,
                    marginTop: k === 0 ? 0 : `${-(1.1 + Math.abs(r2) * 1.7).toFixed(2)}vw`,
                    width: sketch ? "72%" : "100%",
                    alignSelf: sketch ? (r > 0 ? "flex-end" : "flex-start") : "stretch",
                    zIndex: index % 3,
                    aspectRatio: item.aspect,
                  } as CSSProperties
                }
              >
                <GalleryImage
                  item={item}
                  alt={altFor(item, index)}
                  sizes="(max-width: 1024px) 50vw, 32vw"
                  priority={index < 2}
                />
              </Reveal>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** 淨土：每件作品獨佔一整屏，永遠不裁切（框的比例就是圖的比例），高度上限 76vh。 */
function StillGallery({ items, altFor }: GalleryProps) {
  return (
    <div>
      {items.map((item, index) => (
        <Reveal
          key={item.id}
          index={index}
          className="gallery-still flex min-h-[100svh] items-center justify-center px-[8%] py-[12vh]"
        >
          <div
            className="relative"
            style={{ width: `min(80%, calc(76vh * ${item.aspect}))`, aspectRatio: item.aspect }}
          >
            <GalleryImage
              item={item}
              alt={altFor(item, index)}
              sizes="(max-width: 1024px) 80vw, 40vw"
              priority={index < 1}
            />
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/** 邊緣往內咬的鋸齒多邊形（`clip-path`）。`depth` 是最深的內縮百分比；四個角保持完整。 */
function spikyPolygon(seed: number, depth: number) {
  const pts: string[] = [];
  const push = (x: number, y: number) => pts.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  const edge = (n: number, salt: number, at: (u: number, d: number) => [number, number]) => {
    for (let i = 0; i < n; i++) {
      const tip = (i + 0.3 + 0.4 * Math.abs(chaos(seed + salt + i))) / n;
      const d = depth * (0.35 + 0.65 * Math.abs(chaos(seed * 3 + salt + i * 5)));
      push(...at(i / n, 0));
      push(...at(tip, d));
    }
  };
  edge(9, 11, (u, d) => [u * 100, d]); // 上
  edge(12, 23, (u, d) => [100 - d, u * 100]); // 右
  edge(9, 37, (u, d) => [100 - u * 100, 100 - d]); // 下
  edge(12, 41, (u, d) => [d, 100 - u * 100]); // 左
  return `polygon(${pts.join(",")})`;
}

/**
 * X-venom 的「斑點」：鏽紅與軍綠的噴漆斑點，位置確定性生成，密度隨頁面往下
 * 增加（`Math.pow(u, 0.5)` 把亂數往下方擠）。`back` 層在圖後面（只在圖的縫隙與
 * 被咬掉的鋸齒邊露出來），`front` 層是落在圖上的小斑點、只出現在後段。
 */
function InfectionSpots({ layer }: { layer: "back" | "front" }) {
  const spots = useMemo(() => {
    const count = layer === "back" ? 70 : 26;
    return Array.from({ length: count }, (_, i) => {
      const u = Math.abs(chaos(i * 3 + (layer === "back" ? 1 : 500)));
      const y = Math.pow(u, layer === "back" ? 0.55 : 0.4) * 100;
      const x = (chaos(i * 5 + 7 + (layer === "back" ? 0 : 300)) + 1) * 50;
      const size = layer === "back" ? 24 + Math.abs(chaos(i * 11 + 2)) * 110 : 8 + Math.abs(chaos(i * 13 + 4)) * 30;
      const rust = chaos(i * 17 + 9) > -0.15;
      return { x, y, size, rust, squash: 0.7 + Math.abs(chaos(i * 19 + 6)) * 0.6, alpha: 0.4 + Math.abs(chaos(i * 23 + 8)) * 0.45 };
    });
  }, [layer]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${layer === "front" ? "z-10" : ""}`}
    >
      {spots.map((sp, i) => {
        const c = sp.rust ? "176, 58, 32" : "96, 96, 54";
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${sp.x.toFixed(1)}%`,
              top: `${sp.y.toFixed(1)}%`,
              // 數值一律取整成固定小數位、用 backgroundImage 而不是簡寫：長小數會被
              // 瀏覽器解析 style 屬性時四捨五入，React 比對伺服器/客戶端 HTML 時會
              // 誤判成 hydration mismatch（實測抓到）。
              width: `${sp.size.toFixed(1)}px`,
              height: `${sp.size.toFixed(1)}px`,
              opacity: Number(sp.alpha.toFixed(2)),
              transform: `translate(-50%, -50%) scaleY(${sp.squash.toFixed(2)})`,
              backgroundImage: `radial-gradient(circle, rgba(${c}, 1) 0%, rgba(${c}, 0.85) 34%, rgba(${c}, 0) 72%)`,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * X-venom「感染擴散」：故事是逐步失控（SPEC §10.1），所以作品全程清楚可見，
 * 靠「病徵」一步步出現，而不是用模糊/壓暗遮住作品（原本的游標透鏡業主看過後
 * 取消了）：
 * - 尖刺：越往後每張圖的邊緣被咬出越深的鋸齒（`clip-path`，深度 0.6%→5.5%）；
 *   海報是設計師自己的作品，永遠保持完整、不切。
 * - 斑點：見 `InfectionSpots`。
 * - 神經失控：捲得越快圖越抖越歪（`--v` 由捲動速度決定，停下來 0.4 秒內恢復；
 *   `prefers-reduced-motion` 一律不動）。
 * - 作品間距 20vh→1vh、寬度 56%→94% 逐件縮小放大，越來越壓迫。
 */
function VenomGallery({
  items,
  altFor,
  rootRef,
}: GalleryProps & { rootRef: RefObject<HTMLElement | null> }) {
  const n = items.length;
  // 尖刺從第一張「非海報」開始才長：海報（排在最前面）保持完整，之後從 0.6% 平順長到 5.5%
  const firstInfected = Math.max(0, items.findIndex((it) => it.kind !== "poster"));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let timer: number | undefined;
    const onScroll = () => {
      const now = performance.now();
      const speed = Math.abs(window.scrollY - lastY) / Math.max(1, now - lastT); // px/ms
      root.style.setProperty("--v", Math.min(1, speed / 3).toFixed(2));
      lastY = window.scrollY;
      lastT = now;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => root.style.setProperty("--v", "0"), 90);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [rootRef]);

  return (
    <div className="relative">
      <InfectionSpots layer="back" />
      <div className="relative flex flex-col px-[4%] pb-[16vh] pt-[6vh]">
        {items.map((item, index) => {
          const t = n > 1 ? index / (n - 1) : 0;
          const tInfected = n - 1 > firstInfected ? Math.max(0, index - firstInfected) / (n - 1 - firstInfected) : 0;
          const depth = item.kind === "poster" ? 0 : lerp(0.6, 5.5, tInfected);
          const sign = index % 2 === 0 ? 1 : -1;
          return (
            <Reveal
              key={item.id}
              index={index}
              className="gallery-venom venom-jitter relative"
              style={
                {
                  "--jx": `${(sign * (3 + Math.abs(chaos(index + 3)) * 4)).toFixed(1)}px`,
                  "--jsk": `${(sign * (0.8 + Math.abs(chaos(index + 9)) * 1.4)).toFixed(2)}deg`,
                  marginTop: index === 0 ? 0 : `${lerp(20, 1, t).toFixed(1)}vh`,
                  width: `${lerp(56, 94, t).toFixed(1)}%`,
                  alignSelf: index % 2 === 0 ? "flex-start" : "flex-end",
                  aspectRatio: item.aspect,
                } as CSSProperties
              }
            >
              <div className="absolute inset-0" style={depth > 0 ? { clipPath: spikyPolygon(index + 1, depth) } : undefined}>
                <GalleryImage
                  item={item}
                  alt={altFor(item, index)}
                  sizes="(max-width: 1024px) 94vw, 56vw"
                  priority={index < 2}
                />
              </div>
            </Reveal>
          );
        })}
      </div>
      <InfectionSpots layer="front" />
    </div>
  );
}

/** 敘述的每一行（保留原始換行，SPEC §10.1）。各風格用不同的方式「演出」這段文字。 */
function StatementLines({
  text,
  langClass,
  style,
  activeIndex,
  count,
}: {
  text: string | null;
  langClass: "lang-en" | "lang-zh";
  style: GalleryStyle;
  activeIndex: number;
  count: number;
}) {
  const lines = (text ?? "").split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return null;
  const n = lines.length;
  // still：依目前看到第幾件（佔全部的比例）決定亮起第幾行
  const activeLine = Math.min(n - 1, Math.floor((count > 0 ? (activeIndex + 0.5) / count : 0) * n));

  return (
    <p className={langClass}>
      {lines.map((line, i) => {
        const t = n > 1 ? i / (n - 1) : 0;
        let lineStyle: CSSProperties = { marginBottom: "0.5em" };
        if (style === "still") {
          lineStyle = {
            marginBottom: "0.6em",
            opacity: i === activeLine ? 1 : i < activeLine ? 0.55 : 0.22,
            transition: "opacity 0.9s ease",
          };
        } else if (style === "venom") {
          lineStyle = {
            lineHeight: lerp(1.95, 1.05, t),
            marginBottom: `${lerp(0.9, 0.15, t).toFixed(2)}em`,
            letterSpacing: `${(-0.012 * i).toFixed(3)}em`,
            textShadow: "calc(var(--p, 0) * 2px) 0 rgba(176, 58, 32, 0.85)",
          };
        }
        return (
          <span key={i} className="block" style={lineStyle}>
            {line}
          </span>
        );
      })}
    </p>
  );
}

function InfoPanel({
  style,
  titleEn,
  titleZh,
  meta,
  statementEn,
  statementZh,
  active,
  items,
}: {
  style: GalleryStyle;
  titleEn: string;
  titleZh: string | null;
  meta: string;
  statementEn: string | null;
  statementZh: string | null;
  active: number;
  items: GalleryItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  const accent = ACCENT[style];
  const kind = items[active] ? KIND_LABEL[items[active].kind] : null;
  const hasStatement = !!(statementEn || statementZh);

  return (
    <aside className="relative px-6 pb-10 pt-24 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[36%] lg:shrink-0 lg:flex-col lg:self-start lg:px-10 lg:pb-8">
      <div className="min-h-0 flex-1 lg:overflow-y-auto lg:pr-2 lg:[scrollbar-width:none]">
        <h1 className="leading-[1.03]" style={{ fontSize: "clamp(2.25rem, 3.8vw, 4rem)", letterSpacing: "-0.01em" }}>
          <Lang en={titleEn} zh={titleZh ?? ""} role="display" className="series-title-lang" />
        </h1>
        {meta && (
          <p className={`mt-4 opacity-70 ${langFontClass("en", "ui")}`} style={META_STYLE}>
            {meta}
          </p>
        )}
        {hasStatement && (
          <div className="mt-8">
            {/* 手機上收合成約 6 行、有「閱讀概念」展開；桌機（lg）永遠完整顯示 */}
            <div
              className={`statement-stack text-[0.9rem] leading-[1.75] lg:max-h-none lg:overflow-visible lg:text-[0.95rem] ${
                expanded ? "" : "max-h-[9.5rem] overflow-hidden [mask-image:linear-gradient(#000_60%,transparent)] lg:[mask-image:none]"
              }`}
            >
              <StatementLines
                text={statementEn}
                langClass="lang-en"
                style={style}
                activeIndex={active}
                count={items.length}
              />
              <StatementLines
                text={statementZh}
                langClass="lang-zh"
                style={style}
                activeIndex={active}
                count={items.length}
              />
            </div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 min-h-11 underline underline-offset-[6px] opacity-80 lg:hidden"
              style={META_STYLE}
            >
              {expanded ? <Lang en="Show less" zh="收合" role="ui" /> : <Lang en="Read statement" zh="閱讀概念" role="ui" />}
            </button>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-6 hidden lg:block">
          <div className="flex items-end justify-between" style={META_STYLE}>
            <span style={{ color: accent }} aria-hidden="true">
              {pad2(active + 1)} / {pad2(items.length)}
            </span>
            {kind && <Lang en={kind.en} zh={kind.zh} role="ui" className="opacity-70" />}
          </div>
          <div className="mt-3 h-px w-full bg-current/20" aria-hidden="true">
            <div
              className="h-full origin-left"
              style={{ transform: "scaleX(var(--p, 0))", backgroundColor: accent }}
            />
          </div>
        </div>
      )}
    </aside>
  );
}

function SeriesNav({ prev, next }: { prev: AdjacentCollectionLink | null; next: AdjacentCollectionLink | null }) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Series" className="flex justify-between gap-6 px-6 py-20 lg:px-10" style={META_STYLE}>
      <div>
        {prev && (
          <Link href={`/work/${prev.slug}`} className="opacity-80 hover:opacity-100">
            <Lang
              en={`Previous — ${prev.titleEn}`}
              zh={prev.titleZh ? `上一個系列 — ${prev.titleZh}` : "上一個系列"}
              role="ui"
            />
          </Link>
        )}
      </div>
      <div className="text-right">
        {next && (
          <Link href={`/work/${next.slug}`} className="opacity-80 hover:opacity-100">
            <Lang
              en={`Next — ${next.titleEn}`}
              zh={next.titleZh ? `下一個系列 — ${next.titleZh}` : "下一個系列"}
              role="ui"
            />
          </Link>
        )}
      </div>
    </nav>
  );
}

export function SeriesGallery({
  style,
  theme,
  lang,
  titleEn,
  titleZh,
  statementEn,
  statementZh,
  year,
  category,
  pieceCount,
  items,
  prev,
  next,
}: {
  style: GalleryStyle;
  theme: RenderTheme;
  lang: "en" | "zh";
  titleEn: string;
  titleZh: string | null;
  statementEn: string | null;
  statementZh: string | null;
  year: string | null;
  category: string | null;
  pieceCount: number | null;
  items: GalleryItem[];
  prev: AdjacentCollectionLink | null;
  next: AdjacentCollectionLink | null;
}) {
  const colors = THEME_COLORS[theme];
  const rootRef = useRef<HTMLElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const active = useGalleryTracking(rootRef, galleryRef, items.length);
  const meta = [year, category, pieceCount ? `${pieceCount} pieces` : null].filter(Boolean).join(" — ");

  // 圖庫裡的 alt 文字目前都是空的（後台沒填過），退回「系列名 — 類型 序號」，
  // 至少讀得出這張圖屬於哪個系列、是哪一類、第幾件。
  const altFor = (item: GalleryItem, index: number) =>
    item.altEn || `${titleEn} — ${KIND_LABEL[item.kind].en} ${index + 1}`;

  // `overflow-x-clip`（不是 hidden）：Cumedy Night 的圖片傾斜/往右位移會超出視窗約
  // 10px 造成橫向捲動（實測抓到），clip 不會建立捲動容器，左欄的 sticky 不受影響。
  return (
    <main
      ref={rootRef}
      data-lang={lang}
      data-theme={theme}
      className={`${langFontVariables} ${langFontClass(lang, "ui")} min-h-screen overflow-x-clip lg:flex`}
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      <InfoPanel
        style={style}
        titleEn={titleEn}
        titleZh={titleZh}
        meta={meta}
        statementEn={statementEn}
        statementZh={statementZh}
        active={active}
        items={items}
      />
      <div ref={galleryRef} className="min-w-0 lg:flex-1">
        {items.length === 0 ? (
          <p className="px-6 py-24 opacity-60 lg:px-10">
            <Lang en="No works yet." zh="還沒有作品。" role="ui" />
          </p>
        ) : style === "still" ? (
          <StillGallery items={items} altFor={altFor} />
        ) : style === "venom" ? (
          <VenomGallery items={items} altFor={altFor} rootRef={rootRef} />
        ) : (
          <FlashGallery items={items} altFor={altFor} />
        )}
        <SeriesNav prev={prev} next={next} />
      </div>
    </main>
  );
}
