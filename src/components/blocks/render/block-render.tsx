"use client";

import Image from "next/image";
import { useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { Lang, langFontClass, langFontVariables } from "@/components/lang";
import type { RenderBlock, RenderMediaOption, RenderTheme } from "./types";

/**
 * 12 種區塊的共用渲染元件（SPEC.md §13 項目 19 即時預覽 + 項目 23 前台
 * 渲染，兩邊現在是同一份程式碼）。
 *
 * 沿革：這批元件原本叫「結構性預覽」，只驗證區塊順序/選圖/文案，沒有
 * 字體、精確字級、動效。這次升級套用 SPEC §5 的設計系統（字體/字級/
 * 間距/色彩），iframe 預覽跟未來的 `/work/[slug]` 前台頁面現在 import
 * 的是同一份元件——升級完 iframe 預覽也「順便」變成正式視覺等級，
 * 不需要維護兩份。
 *
 * SPEC §6（語言系統）已經套用：`Lang` 元件同時渲染 `.lang-en`/
 * `.lang-zh` 兩個 span，視覺主從由 `globals.css` 依 `data-lang`（掛在
 * 這支的根容器上，見 `CollectionBlocksRender`）決定，不是 JS 條件渲染
 * ——切換語言不影響這裡任何一行渲染邏輯，純 CSS。`EmptyMediaLabel`／
 * `MediaBox` 的「（未選圖片）」之類系統提示文字不在這次雙語化範圍內
 * （SPEC §6 談的是內容語言，不是這類除錯/占位用途的 UI 文字），維持
 * 單語（沿用呼叫端傳入的 `lang`）。
 *
 * 刻意還沒做的事（不在這批範圍內，留給後續判斷）：
 * - lens 區塊已經是真的滑鼠追蹤（`clip-path` 圓形遮罩 + `onMouseMove`
 *   即時更新座標，見 `LensBlock`），不是靜態近似了。行動裝置（沒有滑鼠）
 *   會停在畫面正中央——SPEC §3.11 提到的「行動裝置上隨捲動位移」這個
 *   額外行為還沒做，目前只是固定置中，這部分留給之後有需要再補，不在這
 *   次補救範圍內。
 * - detail-strip 的水平捲動、sketch-cluster 的三種排列模式（overlap/
 *   grid/scatter）目前都只有近似效果，不是最終動效規格。
 */

type CSSVarStyle = CSSProperties & Record<`--${string}`, string | number>;

const THEME_VARS: Record<RenderTheme, CSSVarStyle> = {
  dark: { "--bg": "#0A0A0A", "--fg": "#E8E8E8" },
  light: { "--bg": "#F2F3F4", "--fg": "#111111" },
  void: { "--bg": "#000000", "--fg": "#FFFFFF" },
};

// SPEC.md §5.3 —— 間距 token，基準單位 8px。
const SPACING_VARS: CSSVarStyle = {
  "--space-section": "clamp(4rem, 10vw, 12rem)",
  "--space-block": "clamp(2rem, 5vw, 6rem)",
  "--gutter": "clamp(1.25rem, 4vw, 3rem)",
};

/**
 * SPEC §5.2 只明確給了 Statement large 一組 clamp（2rem,4vw,3.5rem）跟
 * 內文（0.95rem/0.9rem）、UI/Meta（0.65rem/0.62rem）。small/medium/
 * display 三種 statement 尺寸、以及 full-bleed 疊字這些 SPEC 沒寫明的
 * 級距，是這批依既有數字內插出來的（比 large 小/大一階、不超過系列標題
 * 上限 7rem），標記在 HANDOFF.md 供設計師覆核。
 */
const STATEMENT_SIZE_STYLE: Record<string, { fontSize: string; tracking: string }> = {
  small: { fontSize: "clamp(1rem, 2vw, 1.25rem)", tracking: "0em" },
  medium: { fontSize: "clamp(1.5rem, 3vw, 2rem)", tracking: "-0.005em" },
  large: { fontSize: "clamp(2rem, 4vw, 3.5rem)", tracking: "-0.005em" },
  display: { fontSize: "clamp(2.75rem, 6vw, 5rem)", tracking: "-0.01em" },
};

const OVERLAY_TEXT_SIZE = "clamp(1.5rem, 4vw, 2.5rem)";
// SPEC §5.2 內文：手機 0.9rem／桌機 0.95rem，字距 0。用 Tailwind 響應式
// class（不是 CSS 變數）——手機優先，md 以上覆蓋成桌機字級。
const BODY_TEXT_CLASS = "text-[0.9rem] md:text-[0.95rem]";
// SPEC §5.2 UI/Meta：手機 0.62rem／桌機 0.65rem，字距 0.18em。
const META_TEXT_CLASS = "text-[0.62rem] md:text-[0.65rem] tracking-[0.18em]";

function findMedia(mediaOptions: RenderMediaOption[], id: string | null | undefined) {
  if (!id) return null;
  return mediaOptions.find((m) => m.id === id) ?? null;
}

/**
 * SPEC.md §9.2「所有圖片需 alt 文字」——`media.altEn`/`altZh` 早就存在於
 * 資料庫跟 admin 上傳表單，但這支共用渲染元件一直沒有接到，之前用
 * `filename` 頂著（例如 `"DSC02109.jpeg"`），對螢幕閱讀器使用者完全沒有
 * 意義，等於作品照片本身（這個網站的核心內容）長期沒有可用的 alt 文字。
 * 依目前語言模式挑對應語言的 alt，缺該語言時 fallback 另一語言，兩者都
 * 沒填才真的留空（等同裝飾性圖片處理，不是刻意放棄，是沒有資料可用）。
 */
function altTextFor(option: RenderMediaOption | null, lang: "en" | "zh"): string {
  if (!option) return "";
  const primary = lang === "en" ? option.altEn : option.altZh;
  const secondary = lang === "en" ? option.altZh : option.altEn;
  return primary ?? secondary ?? "";
}

function MediaBox({
  mediaOptions,
  id,
  lang,
  className,
  style,
  sizes,
}: {
  mediaOptions: RenderMediaOption[];
  id: string | null | undefined;
  lang: "en" | "zh";
  className?: string;
  style?: CSSProperties;
  sizes?: string;
}) {
  const found = findMedia(mediaOptions, id);
  return (
    // 定位（relative/absolute）與尺寸一律由呼叫端透過 className 指定，這裡
    // 不內建 relative——如果呼叫端要疊加 absolute（例如 full-bleed 貼滿父層）
    // 又被這裡寫死的 relative 蓋掉，會讓容器高度塌陷成 0，圖片完全不可見
    // （實測跑出來的問題，不是預先猜的）。
    <div className={`overflow-hidden bg-white/10 ${className ?? ""}`} style={style}>
      {found ? (
        <Image
          src={found.r2Key}
          alt={altTextFor(found, lang)}
          fill
          sizes={sizes ?? "50vw"}
          style={{ objectFit: "cover" }}
        />
      ) : (
        <div
          className={`flex h-full items-center justify-center opacity-60 ${META_TEXT_CLASS} ${langFontClass("en", "ui")}`}
        >
          （未選圖片）
        </div>
      )}
    </div>
  );
}

const STATEMENT_ALIGN_CLASS: Record<string, string> = {
  left: "text-left",
  center: "text-center mx-auto",
};

const STATEMENT_RHYTHM_LEADING: Record<string, string> = {
  normal: "leading-normal",
  spacious: "leading-loose",
  tightening: "leading-tight",
};

const SINGLE_WIDTH_CLASS: Record<string, string> = {
  narrow: "max-w-sm",
  medium: "max-w-2xl",
  wide: "max-w-4xl",
};

const SPACER_HEIGHT_CLASS: Record<string, string> = {
  small: "h-8",
  medium: "h-16",
  large: "h-32",
  xlarge: "h-56",
};

const GAP_CLASS: Record<string, string> = {
  none: "gap-0",
  small: "gap-2",
  large: "gap-8",
  hairline: "gap-px",
};

const ITEM_HEIGHT_CLASS: Record<string, string> = {
  small: "h-32",
  medium: "h-48",
  large: "h-72",
};

const IMAGE_WIDTH_CLASS: Record<string, string> = {
  third: "w-1/3",
  half: "w-1/2",
  "two-thirds": "w-2/3",
};

const VERTICAL_ALIGN_CLASS: Record<string, string> = {
  top: "items-start",
  center: "items-center",
  bottom: "items-end",
};

const RADIUS_PX: Record<string, number> = {
  small: 60,
  medium: 110,
  large: 180,
};

/**
 * SPEC §3.11：畫面暗化，僅圓形遮罩內清晰，遮罩跟隨游標移動。用
 * `clip-path: circle()` 讓上層的清晰圖只在游標所在的圓形範圍內可見，
 * `onMouseMove` 即時算座標——純 CSS/JS，不需要新的資料模型。
 * `followCursor === false` 時（SPEC 的「固定」狀態）不掛滑鼠事件，圓形
 * 固定在正中央。行動裝置沒有滑鼠事件，`pos` 永遠是 `null`，效果等同
 * SPEC §3.11 提到的「行動裝置上改為固定置中的圓」——但「隨捲動位移」
 * 這個額外行為還沒做，留到之後真的有需要再補。
 */
function LensBlock({
  mediaOptions,
  mediaId,
  lang,
  radius,
  followCursor,
}: {
  mediaOptions: RenderMediaOption[];
  mediaId: string | null;
  lang: "en" | "zh";
  radius: string;
  followCursor: boolean;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const r = RADIUS_PX[radius];

  function handleMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  const clipPath = pos
    ? `circle(${r}px at ${pos.x}px ${pos.y}px)`
    : `circle(${r}px at 50% 50%)`;

  return (
    <div
      className="relative aspect-video w-full overflow-hidden"
      onMouseMove={followCursor ? handleMouseMove : undefined}
      onMouseLeave={followCursor ? () => setPos(null) : undefined}
    >
      <MediaBox mediaOptions={mediaOptions} lang={lang} id={mediaId} className="absolute inset-0 h-full w-full opacity-30" />
      <div className="pointer-events-none absolute inset-0" style={{ clipPath }}>
        <MediaBox mediaOptions={mediaOptions} lang={lang} id={mediaId} className="relative h-full w-full" />
      </div>
    </div>
  );
}

export function BlockRenderer({
  block,
  mediaOptions,
  lang,
}: {
  block: RenderBlock;
  mediaOptions: RenderMediaOption[];
  lang: "en" | "zh";
}) {
  const c = block.config as Record<string, unknown>;

  switch (block.type) {
    case "full-bleed": {
      const height = (c.height as string) ?? "screen";
      const heightClass =
        height === "screen" ? "min-h-[70vh]" : height === "large" ? "min-h-[50vh]" : "min-h-[30vh]";
      const overlayText = (c.overlayText as { en: string; zh: string }) ?? { en: "", zh: "" };
      const overlayPosition = (c.overlayPosition as string) ?? "none";
      const overlayClass =
        overlayPosition === "center"
          ? "items-center justify-center text-center"
          : overlayPosition === "bottom-left"
            ? "items-end justify-start text-left"
            : overlayPosition === "bottom-right"
              ? "items-end justify-end text-right"
              : "hidden";
      return (
        <div className={`relative w-full ${heightClass}`}>
          <MediaBox mediaOptions={mediaOptions} lang={lang} id={c.mediaId as string | null} className="absolute inset-0 h-full w-full" sizes="100vw" />
          {overlayPosition !== "none" && (
            <div className={`relative z-10 flex h-full w-full p-8 font-medium ${overlayClass}`}>
              <span
                className="rounded bg-black/40 px-3 py-1 text-white"
                style={{ fontSize: OVERLAY_TEXT_SIZE, letterSpacing: "-0.005em" }}
              >
                <Lang {...overlayText} role="display" />
              </span>
            </div>
          )}
        </div>
      );
    }

    case "single": {
      const width = (c.width as string) ?? "medium";
      const caption = (c.caption as { en: string; zh: string }) ?? { en: "", zh: "" };
      return (
        <div className={`mx-auto flex flex-col gap-2 ${SINGLE_WIDTH_CLASS[width]}`}>
          <MediaBox mediaOptions={mediaOptions} lang={lang} id={c.mediaId as string | null} className="relative aspect-[3/4] w-full" />
          {/* 不用 opacity-70 包 <Lang>——跟 divider 同一個坑，見那裡的註解 */}
          <p className={BODY_TEXT_CLASS}>
            <Lang {...caption} role="ui" />
          </p>
        </div>
      );
    }

    case "pair": {
      const ratio = (c.ratio as string) ?? "2:3";
      const gap = (c.gap as string) ?? "small";
      const offset = !!c.offset;
      const aspect =
        ratio === "1:1" ? "aspect-square" : ratio === "3:2" ? "aspect-[3/2]" : "aspect-[2/3]";
      return (
        <div className={`flex w-full ${GAP_CLASS[gap]}`}>
          <MediaBox mediaOptions={mediaOptions} lang={lang} id={c.leftMediaId as string | null} className={`relative flex-1 ${aspect}`} />
          <MediaBox
            mediaOptions={mediaOptions}
            lang={lang}
            id={c.rightMediaId as string | null}
            className={`relative flex-1 ${aspect}`}
            style={offset ? { marginTop: "10%" } : undefined}
          />
        </div>
      );
    }

    case "triptych": {
      const mediaIds = (c.mediaIds as string[]) ?? [];
      const gap = (c.gap as string) ?? "small";
      return (
        <div className={`flex w-full ${GAP_CLASS[gap]}`}>
          {mediaIds.length === 0 ? (
            <EmptyMediaLabel lang={lang} />
          ) : (
            mediaIds.map((id, i) => (
              <MediaBox key={id + i} mediaOptions={mediaOptions} lang={lang} id={id} className="relative aspect-square flex-1" />
            ))
          )}
        </div>
      );
    }

    case "statement": {
      const size = (c.size as string) ?? "medium";
      const align = (c.align as string) ?? "center";
      const rhythm = (c.rhythm as string) ?? "normal";
      const sizeStyle = STATEMENT_SIZE_STYLE[size];
      return (
        <div
          className={`max-w-3xl ${STATEMENT_ALIGN_CLASS[align]} ${STATEMENT_RHYTHM_LEADING[rhythm]}`}
          style={{ fontSize: sizeStyle.fontSize, letterSpacing: sizeStyle.tracking }}
        >
          <Lang en={(c.textEn as string) ?? ""} zh={(c.textZh as string) ?? ""} role="display" />
        </div>
      );
    }

    case "text-image": {
      const imageSide = (c.imageSide as string) ?? "left";
      const imageWidth = (c.imageWidth as string) ?? "half";
      const verticalAlign = (c.verticalAlign as string) ?? "center";
      const imageBox = (
        <MediaBox
          mediaOptions={mediaOptions}
          lang={lang}
          id={c.mediaId as string | null}
          className={`relative aspect-[4/5] ${IMAGE_WIDTH_CLASS[imageWidth]}`}
        />
      );
      const textBox = (
        <div className={`flex-1 ${BODY_TEXT_CLASS}`}>
          <Lang en={(c.textEn as string) ?? ""} zh={(c.textZh as string) ?? ""} role="ui" />
        </div>
      );
      return (
        <div className={`flex w-full gap-6 ${VERTICAL_ALIGN_CLASS[verticalAlign]}`}>
          {imageSide === "left" ? (
            <>
              {imageBox}
              {textBox}
            </>
          ) : (
            <>
              {textBox}
              {imageBox}
            </>
          )}
        </div>
      );
    }

    case "detail-strip": {
      const mediaIds = (c.mediaIds as string[]) ?? [];
      const itemHeight = (c.itemHeight as string) ?? "medium";
      return (
        <div className="flex w-full gap-2 overflow-x-auto">
          {mediaIds.length === 0 ? (
            <EmptyMediaLabel lang={lang} />
          ) : (
            mediaIds.map((id, i) => (
              <MediaBox
                key={id + i}
                mediaOptions={mediaOptions}
                lang={lang}
                id={id}
                className={`relative aspect-square shrink-0 ${ITEM_HEIGHT_CLASS[itemHeight]}`}
              />
            ))
          )}
        </div>
      );
    }

    case "sketch-cluster": {
      const mediaIds = (c.mediaIds as string[]) ?? [];
      const layout = (c.layout as string) ?? "scatter";
      const allowBleed = !!c.allowBleed;
      return (
        <div
          className={`flex flex-wrap gap-3 ${allowBleed ? "-mx-4" : ""}`}
          title={`layout: ${layout}`}
        >
          {mediaIds.length === 0 ? (
            <EmptyMediaLabel lang={lang} />
          ) : (
            mediaIds.map((id, i) => (
              <MediaBox
                key={id + i}
                mediaOptions={mediaOptions}
                lang={lang}
                id={id}
                className="relative aspect-[3/4] w-32"
                style={layout === "scatter" ? { transform: `rotate(${(i % 5) - 2}deg)` } : undefined}
              />
            ))
          )}
        </div>
      );
    }

    case "spacer": {
      const size = (c.size as string) ?? "medium";
      return <div className={SPACER_HEIGHT_CLASS[size]} />;
    }

    case "divider": {
      const style = (c.style as string) ?? "hairline";
      const label = (c.label as { en: string; zh: string }) ?? { en: "", zh: "" };
      // `opacity-60`只放在兩條線本身（裝飾用，不是文字，WCAG 對比不適用），
      // 不要包住 `Lang` 標籤——無障礙排查批次抓到：`opacity-*` 包住
      // `Lang` 元件會跟 `.lang-en`/`.lang-zh` 自己的 0.55 opacity 疊乘
      // （例如這裡原本 0.6 × 0.55 ≈ 0.33），次要語言那個 span 的對比會
      // 掉到 WCAG AA 門檻以下，比只有語言系統自己的 0.55 還要更差。
      return (
        <div className={`flex items-center gap-3 ${META_TEXT_CLASS}`}>
          {style === "hairline" && (
            <div className="h-px flex-1 opacity-60" style={{ backgroundColor: "currentColor" }} />
          )}
          {(label.en || label.zh) && <Lang {...label} role="ui" />}
          {style === "hairline" && (
            <div className="h-px flex-1 opacity-60" style={{ backgroundColor: "currentColor" }} />
          )}
        </div>
      );
    }

    case "lens": {
      const radius = (c.radius as string) ?? "medium";
      const followCursor = !!c.followCursor;
      return (
        <LensBlock
          mediaOptions={mediaOptions}
          mediaId={c.mediaId as string | null}
          lang={lang}
          radius={radius}
          followCursor={followCursor}
        />
      );
    }

    case "mirror": {
      const axis = (c.axis as string) ?? "vertical";
      const gap = (c.gap as string) ?? "none";
      const isVertical = axis === "vertical";
      return (
        <div className={`flex w-full ${isVertical ? "flex-row" : "flex-col"} ${GAP_CLASS[gap]}`}>
          <MediaBox mediaOptions={mediaOptions} lang={lang} id={c.mediaId as string | null} className="relative aspect-square flex-1" />
          <MediaBox
            mediaOptions={mediaOptions}
            lang={lang}
            id={c.mediaId as string | null}
            className="relative aspect-square flex-1"
            style={{ transform: isVertical ? "scaleX(-1)" : "scaleY(-1)" }}
          />
        </div>
      );
    }

    default:
      return <span className="text-xs text-red-500">（未知區塊類型：{block.type}）</span>;
  }
}

// opacity-60 不是 opacity-40——這裡跟 MediaBox 的「（未選圖片）」一樣，
// 原本 40 在 dark/void 主題只有 ~3.3:1，META_TEXT_CLASS 字級小，
// WCAG AA 一般文字門檻 4.5:1 沒過（無障礙排查批次抓到，見 HANDOFF.md）。
function EmptyMediaLabel({ lang }: { lang: "en" | "zh" }) {
  return (
    <span className={`opacity-60 ${META_TEXT_CLASS} ${langFontClass(lang, "ui")}`}>
      （尚未選圖片）
    </span>
  );
}

export function CollectionBlocksRender({
  theme,
  blocks,
  mediaOptions,
  lang,
  titleEn,
  titleZh,
}: {
  theme: RenderTheme;
  blocks: RenderBlock[];
  mediaOptions: RenderMediaOption[];
  lang: "en" | "zh";
  /**
   * 系列標題,只用來渲染一個視覺隱藏的 `<h1>`（無障礙排查批次抓到：
   * 區塊系統本身沒有固定的「標題」欄位——設計師可以自由編排任何區塊
   * 組合,不像多數網站有寫死的標題欄位——這代表 `/work/[slug]` 原本
   * 整頁沒有任何 `<h1>`,螢幕閱讀器使用者用標題導覽找不到頁面主標題。
   * 選擇視覺隱藏而不是真的顯示出來,是因為視覺標題已經由設計師透過
   * 區塊自由編排決定（例如 statement 區塊、full-bleed 疊字），不該由
   * 這支共用元件蓋過去）。可選——admin 即時預覽目前沒有接這兩個
   * prop,不影響預覽現有行為。
   */
  titleEn?: string;
  titleZh?: string | null;
}) {
  const themeVars = THEME_VARS[theme];
  return (
    // <main>——無障礙排查批次抓到（Lighthouse `landmark-one-main`）：
    // 全站沒有任何 <main> landmark，螢幕閱讀器使用者無法跳過重複的頁首
    // 直接到主要內容。這裡是 `/work/[slug]` 唯一的主要內容區塊，改
    // <div> 為 <main> 就能滿足，不用另外包一層。
    <main
      data-lang={lang}
      className={`${langFontVariables} flex min-h-screen flex-col ${BODY_TEXT_CLASS} ${langFontClass(lang, "ui")}`}
      style={{
        ...themeVars,
        ...SPACING_VARS,
        backgroundColor: "var(--bg)",
        color: "var(--fg)",
        gap: "var(--space-block)",
        paddingLeft: "var(--gutter)",
        paddingRight: "var(--gutter)",
        paddingTop: "var(--space-block)",
        paddingBottom: "var(--space-block)",
      }}
    >
      {titleEn && (
        <h1 className="sr-only">
          {titleEn}
          {titleZh ? ` / ${titleZh}` : ""}
        </h1>
      )}
      {blocks.length === 0 && (
        <p className={`opacity-50 ${BODY_TEXT_CLASS}`}>這個系列還沒有任何區塊。</p>
      )}
      {blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} mediaOptions={mediaOptions} lang={lang} />
      ))}
    </main>
  );
}
