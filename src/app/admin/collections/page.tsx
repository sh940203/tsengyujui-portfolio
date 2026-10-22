import { asc } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { collections, media } from "@/lib/db/schema";
import { THEME_META, VISIBILITY_META } from "@/components/admin/collection-meta";
import { Badge, PageHeader } from "@/components/admin/ui/primitives";
import { buttonClass } from "@/components/admin/ui/styles";
import { IconExternal, IconEyeOff, IconImage, IconStar } from "@/components/admin/ui/icons";

export const metadata = { title: "系列" };

/** 系列列表（原本是一張顯示 `slug`/`theme`/`requiresConsent` 代碼的表格）。 */
export default async function AdminCollectionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const [rows, mediaRows] = await Promise.all([
    db
      .select({
        id: collections.id,
        slug: collections.slug,
        titleEn: collections.titleEn,
        titleZh: collections.titleZh,
        year: collections.year,
        category: collections.category,
        theme: collections.theme,
        visibility: collections.visibility,
        coverImageId: collections.coverImageId,
      })
      .from(collections)
      .orderBy(asc(collections.sortOrder)),
    db
      .select({
        id: media.id,
        r2Key: media.r2Key,
        collectionId: media.collectionId,
        galleryHidden: media.galleryHidden,
        featuredOrder: media.featuredOrder,
      })
      .from(media)
      .orderBy(asc(media.sortOrder)),
  ]);

  return (
    <>
      <PageHeader title="系列" description="點進系列編輯基本資料、敘述、外觀，以及作品長廊要顯示哪些作品、排什麼順序。" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((c) => {
          const own = mediaRows.filter((m) => m.collectionId === c.id);
          const shown = own.filter((m) => !m.galleryHidden).length;
          const hidden = own.length - shown;
          const featured = own.filter((m) => m.featuredOrder !== null && !m.galleryHidden).length;
          const cover =
            (c.coverImageId ? own.find((m) => m.id === c.coverImageId) : undefined) ?? own.find((m) => !m.galleryHidden);
          const vis = VISIBILITY_META[c.visibility];
          const theme = THEME_META[c.theme];
          const meta = [c.year, c.category].filter(Boolean).join(" · ");
          return (
            <article
              key={c.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-lg"
            >
              <Link href={`/admin/collections/${c.id}`} className="absolute inset-0 z-[1]" aria-label={`編輯 ${c.titleZh ?? c.titleEn}`} />
              <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                {cover && (
                  <Image
                    src={cover.r2Key}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 92vw, (max-width: 1280px) 45vw, 380px"
                    style={{ objectFit: "cover" }}
                    className="transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                )}
                <div className="absolute left-3 top-3">
                  <Badge tone={vis.tone} dot className="bg-white/90 backdrop-blur">
                    {vis.label}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <h2 className="truncate text-[15px] font-semibold text-stone-900">{c.titleZh ?? c.titleEn}</h2>
                  <p className="truncate text-[13px] text-stone-500">
                    {c.titleEn}
                    {meta && <span className="text-stone-400"> · {meta}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500">
                  <span className="inline-flex items-center gap-1.5">
                    <IconImage size={14} className="text-stone-400" />
                    長廊 {shown} 件
                  </span>
                  {hidden > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <IconEyeOff size={14} className="text-stone-400" />
                      隱藏 {hidden}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <IconStar size={14} className="text-stone-400" />
                    首頁精選 {featured}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="flex overflow-hidden rounded-full ring-1 ring-stone-300">
                      <span className="h-3 w-1.5" style={{ background: theme.swatch[0] }} />
                      <span className="h-3 w-1.5" style={{ background: theme.swatch[1] }} />
                    </span>
                    {theme.label}・{theme.style}
                  </span>
                </div>
                <div className="relative z-[2] mt-auto flex gap-2 pt-1">
                  <Link href={`/admin/collections/${c.id}`} className={buttonClass("primary", "sm", "flex-1")}>
                    編輯
                  </Link>
                  {c.visibility !== "draft" && (
                    <a
                      href={`/work/${c.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonClass("secondary", "sm")}
                      aria-label="在新分頁查看前台"
                    >
                      <IconExternal size={15} />
                      前台
                    </a>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
