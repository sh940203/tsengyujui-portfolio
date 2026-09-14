import Image from "next/image";
import Link from "next/link";
import { Lang, langFontClass } from "@/components/lang";

/**
 * 首頁 Hero 以外的三個區塊（SPEC.md §4.2）。都是 Server Component（沒有
 * "use client"），互動只有語言切換，交給 `home-page-client.tsx` 那層薄
 * wrapper 處理。Hero 本身因為要做背景輪播（`setInterval` 自動播放），需要
 * client-side state，搬到獨立的 `hero.tsx`。
 *
 * SPEC §5.1：介面色（導航、頁尾、UI 文字）僅黑灰白三色，跟系列頁跟著
 * `theme` 走不同——首頁屬於「介面」，固定用 --ui-black 深底，不套用任何
 * 系列的 dark/light/void。
 *
 * `SiteFooter` 搬到 `src/components/site-footer.tsx`（關於頁也要用）。
 */

export interface SeriesListItem {
  slug: string;
  titleEn: string;
  titleZh: string | null;
  year: string | null;
  category: string | null;
  coverR2Key: string | null;
}

export function SeriesList({ items }: { items: SeriesListItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="bg-[#0A0A0A] px-6 py-[clamp(4rem,10vw,12rem)] text-[#F2F3F4]">
      <div className="mx-auto flex max-w-6xl flex-col gap-[clamp(2rem,5vw,6rem)]">
        {items.map((item) => (
          <Link key={item.slug} href={`/work/${item.slug}`} className="group flex flex-col gap-4">
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-white/5 sm:aspect-[16/9]">
              {item.coverR2Key && (
                <Image
                  src={item.coverR2Key}
                  alt={item.titleEn}
                  fill
                  sizes="(max-width: 640px) 100vw, 1200px"
                  style={{ objectFit: "cover" }}
                  className="transition-transform duration-500 group-hover:scale-105"
                />
              )}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)", letterSpacing: "-0.01em" }}>
                <Lang en={item.titleEn} zh={item.titleZh ?? ""} role="display" />
              </h2>
              {(item.year || item.category) && (
                <span
                  className={`opacity-60 ${langFontClass("en", "ui")}`}
                  style={{ fontSize: "0.65rem", letterSpacing: "0.18em" }}
                >
                  {[item.year, item.category].filter(Boolean).join(" — ")}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function BioSection({ bioEn, bioZh }: { bioEn: string | null; bioZh: string | null }) {
  if (!bioEn && !bioZh) return null;
  return (
    <section className="bg-[#0A0A0A] px-6 py-[clamp(4rem,10vw,12rem)] text-[#F2F3F4]">
      <div className="mx-auto max-w-2xl text-center" style={{ fontSize: "clamp(1rem, 2vw, 1.25rem)" }}>
        <Lang en={bioEn ?? ""} zh={bioZh ?? ""} role="ui" />
      </div>
    </section>
  );
}
