import Image from "next/image";
import Link from "next/link";
import { Lang, langFontClass } from "@/components/lang";
import type { RenderTheme } from "@/components/blocks/render/types";
import { THEME_COLORS } from "@/lib/collections/theme-colors";

/**
 * 首頁 Hero 以外的區塊（SPEC.md §4.2）。都是 Server Component（沒有
 * "use client"），互動只有語言切換，交給 `LangPageWrapper` 處理。Hero 本身
 * 因為要做背景輪播，需要 client-side state，搬到獨立的 `hero.tsx`。
 *
 * 2026-09-20 改版：業主指定參考 aoiofficial.com 往下滑的區域。只借用版面
 * 手法（黑白交替的大區塊、不對稱拼貼、左側釘住的文字、捲動釘住的宣言區），
 * 不用對方的文案與圖片：
 * - 每個系列一整段，底色用該系列自己的 `theme`（SPEC §4.3）——三個系列
 *   本來就是 dark / light / void，天然有黑白交替的節奏。這是「作品的一部分」，
 *   不受右上角淺色/深色切換影響（切換只影響 Hero、簡介、頁尾這些「介面」）。
 * - 仍然只有 SPEC §4.2 規定的資訊：封面圖、英文標題、年份、類型，不帶
 *   statement 摘要（業主確認過）。
 */

const META_STYLE = { fontSize: "0.7rem", letterSpacing: "0.18em" } as const;

export interface SeriesShowcaseImage {
  r2Key: string;
  altEn: string | null;
}

export interface SeriesShowcaseItem {
  slug: string;
  titleEn: string;
  titleZh: string | null;
  year: string | null;
  category: string | null;
  theme: RenderTheme;
  images: SeriesShowcaseImage[];
}

/**
 * 單一系列一整段。桌機是 12 欄格線：文字欄（4 欄）用 `sticky` 釘住，右邊的
 * 拼貼往上捲過；奇數/偶數段左右交替（`flip`），DOM 順序永遠是「文字在前、
 * 拼貼在後」，只用 CSS 格線位置換邊，螢幕閱讀器的閱讀順序不受影響。
 *
 * 拼貼：一張高圖（系列封面）＋兩張小圖錯位排列。圖片維持 `cover`——首頁
 * 這裡是導覽用的索引縮圖，不是作品完整呈現的地方（完整呈現在 `/work/[slug]`，
 * 見 HANDOFF Phase 6 第 2 項）。拼貼整塊是連到系列頁的連結，但對輔助技術
 * 隱藏（`aria-hidden` + `tabIndex=-1`），因為同一個目的地已經有「查看系列」
 * 連結，避免螢幕閱讀器/鍵盤重複讀到兩個一樣的連結。
 */
function SeriesSection({ item, index, flip }: { item: SeriesShowcaseItem; index: number; flip: boolean }) {
  const colors = THEME_COLORS[item.theme];
  const [main, ...smalls] = item.images;
  const meta = [item.year, item.category].filter(Boolean).join(" — ");

  return (
    <section
      data-theme={item.theme}
      style={{ backgroundColor: colors.bg, color: colors.fg }}
      className="px-6 py-[clamp(5rem,12vw,11rem)] lg:px-16"
    >
      <div className="mx-auto grid max-w-[90rem] gap-x-[clamp(1.5rem,4vw,4rem)] gap-y-10 lg:grid-cols-12">
        <div
          className={`flex flex-col gap-5 lg:sticky lg:top-28 lg:col-span-4 lg:self-start ${
            flip ? "lg:col-start-9" : "lg:col-start-1"
          }`}
        >
          <span className={`opacity-70 ${langFontClass("en", "ui")}`} style={META_STYLE}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <h2 className="leading-[1.05]" style={{ fontSize: "clamp(2.25rem, 5vw, 4.5rem)", letterSpacing: "-0.01em" }}>
            <Lang en={item.titleEn} zh={item.titleZh ?? ""} role="display" className="series-title-lang" />
          </h2>
          {meta && (
            <span className={`opacity-70 ${langFontClass("en", "ui")}`} style={META_STYLE}>
              {meta}
            </span>
          )}
          <Link
            href={`/work/${item.slug}`}
            className="mt-4 w-fit underline underline-offset-[6px] opacity-90 hover:opacity-100"
            style={META_STYLE}
          >
            <Lang en="View series" zh="查看系列" role="ui" />
          </Link>
        </div>

        {main && (
          <Link
            href={`/work/${item.slug}`}
            tabIndex={-1}
            aria-hidden="true"
            className={`group flex gap-[clamp(0.75rem,1.6vw,1.5rem)] lg:col-span-8 ${
              flip ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-5"
            }`}
          >
            <div className="relative aspect-[2/3] w-[62%] shrink-0 overflow-hidden bg-white/5">
              <Image
                src={main.r2Key}
                alt={main.altEn ?? item.titleEn}
                fill
                sizes="(max-width: 1024px) 62vw, 46vw"
                style={{ objectFit: "cover" }}
                className="motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.03]"
              />
            </div>
            {smalls.length > 0 && (
              <div className="flex min-w-0 flex-1 flex-col gap-[clamp(0.75rem,1.6vw,1.5rem)] pt-[22%]">
                {smalls.map((img, i) => (
                  <div
                    key={img.r2Key}
                    className={`relative aspect-[4/5] overflow-hidden bg-white/5 ${i === 1 ? "w-[78%] self-end" : "w-full"}`}
                  >
                    <Image
                      src={img.r2Key}
                      alt={img.altEn ?? ""}
                      fill
                      sizes="(max-width: 1024px) 34vw, 20vw"
                      style={{ objectFit: "cover" }}
                      className="motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.03]"
                    />
                  </div>
                ))}
              </div>
            )}
          </Link>
        )}
      </div>
    </section>
  );
}

/** `#series` 是導航（`SiteNav` 的 WORK）錨點捲動的目標。 */
export function SeriesSections({ items }: { items: SeriesShowcaseItem[] }) {
  if (items.length === 0) return null;
  return (
    <div id="series">
      {items.map((item, i) => (
        <SeriesSection key={item.slug} item={item} index={i} flip={i % 2 === 1} />
      ))}
    </div>
  );
}

/**
 * 簡介。有圖的時候做成「捲動釘住的宣言區」：外層 200vh 高，裡面一個 `sticky`
 * 滿版容器（圖片＋深色遮罩＋置中文字）——往下捲的前 100vh 畫面停住、文字
 * 留在正中央，之後才捲走。純 CSS（`position: sticky`），沒有 scroll 事件監聽。
 * 文字顏色固定白色（疊在圖片＋固定深色遮罩上，跟淺色/深色主題無關）。
 * 沒有圖就退回單純置中的文字段落；沒有 bio 整段不渲染（目前 bio 還是空的，
 * 待業主提供，見 HANDOFF §5）。
 */
export function BioSection({
  bioEn,
  bioZh,
  imageR2Key,
}: {
  bioEn: string | null;
  bioZh: string | null;
  imageR2Key: string | null;
}) {
  if (!bioEn && !bioZh) return null;
  const text = <Lang en={bioEn ?? ""} zh={bioZh ?? ""} role="ui" />;

  if (!imageR2Key) {
    return (
      <section id="bio" className="bg-[var(--ui-bg)] px-6 py-[clamp(4rem,10vw,12rem)] text-[var(--ui-fg)]">
        <div className="mx-auto max-w-2xl text-center" style={{ fontSize: "clamp(1rem, 2vw, 1.25rem)" }}>
          {text}
        </div>
      </section>
    );
  }

  return (
    <section id="bio" className="relative h-[200vh] bg-black">
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        <Image
          src={imageR2Key}
          alt=""
          fill
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
        <div className="absolute inset-0 bg-black/45" />
        <div
          className="relative z-10 mx-auto max-w-2xl px-6 text-center text-white"
          style={{ fontSize: "clamp(1.05rem, 2.2vw, 1.5rem)", lineHeight: 1.6 }}
        >
          {text}
        </div>
      </div>
    </section>
  );
}
