import type { Metadata } from "next";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getHomeCarouselPairs, getSeriesShowcase } from "@/lib/media/featured";
import { resolveOgImageUrl } from "@/lib/media/resolve-og-image";
import { getProfile } from "@/lib/profile/get-profile";
import { collections, media } from "@/lib/db/schema";
import {
  GENERIC_SITE_DESCRIPTION,
  absoluteUrl,
  buildPersonJsonLd,
  jsonLdScriptProps,
  truncateDescription,
} from "@/lib/seo";
import { LangPageWrapper } from "@/components/lang-page-wrapper";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "./hero";
import { BioSection, SeriesSections } from "./home-sections";

export async function generateMetadata(): Promise<Metadata> {
  const profileRow = await getProfile();
  const title =
    profileRow?.seoTitle ?? `${profileRow?.nameEn ?? "Tseng Yu Jui"} — ${profileRow?.roleEn ?? "Fashion Designer"}`;
  const description = profileRow?.seoDescription
    ? truncateDescription(profileRow.seoDescription)
    : profileRow?.bioEn
      ? truncateDescription(profileRow.bioEn)
      : GENERIC_SITE_DESCRIPTION;
  const image = await resolveOgImageUrl(profileRow?.defaultOgImageId ?? profileRow?.heroImageId);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: absoluteUrl("/") },
    openGraph: {
      title,
      description,
      url: absoluteUrl("/"),
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

/**
 * 首頁（SPEC.md §4.2）：Hero（背景輪播）→ 系列區塊（僅
 * `visibility === 'public'`，查詢層過濾，沿用 `/work/[slug]` 已經定案的
 * 原則，不是前端 filter）→ 簡短簡介 → 頁尾。
 *
 * 系列列表這批刻意不帶 statement 摘要段落（跟業主確認過，維持 SPEC
 * 原文的封面圖＋標題＋年份＋類型）——完整可讀的雙語文字說明段落由
 * `/work/[slug]` 內頁的 statement 區塊負責，見 HANDOFF.md。
 *
 * Hero 背景輪播的圖片池邏輯見 `src/lib/media/featured.ts`（業主精選照，
 * 每個系列各自 fallback 回該系列 sortOrder 最前 3 張）。池子完全是空的
 * （例如還沒有任何系列是 public）時，退回 `profile.heroImageId` 當
 * 單張靜態背景；兩者都沒有就維持純黑背景，跟這批之前驗證過的優雅降級
 * 行為一致。
 */
export default async function HomePage() {
  const profileRow = await getProfile();

  const publicCollections = await db
    .select({
      id: collections.id,
      slug: collections.slug,
      titleEn: collections.titleEn,
      titleZh: collections.titleZh,
      year: collections.year,
      category: collections.category,
      coverImageId: collections.coverImageId,
      theme: collections.theme,
    })
    .from(collections)
    .where(eq(collections.visibility, "public"))
    .orderBy(asc(collections.sortOrder));

  // 只查真的會用到的圖（Hero 的 fallback 靜態圖 + 簡介區塊的釘住背景圖），
  // 不是抓全站 media——原本沒有 `where`，會把每一筆 media（含草稿系列的）
  // 的 `r2Key` 都撈出來，見 SEO 批次全專案排查的結論（`get-profile.ts`
  // 開頭有完整說明）。各系列的拼貼圖另外由 `getSeriesShowcase` 查（只查
  // public 系列、只選需要的欄位）。
  const neededMediaIds = [profileRow?.heroImageId, profileRow?.aboutImageId].filter(
    (id): id is string => !!id,
  );
  const mediaRows =
    neededMediaIds.length > 0
      ? await db
          .select({ id: media.id, r2Key: media.r2Key })
          .from(media)
          .where(inArray(media.id, neededMediaIds))
      : [];
  const mediaMap = new Map(mediaRows.map((m) => [m.id, m.r2Key]));

  const showcaseImages = await Promise.all(
    publicCollections.map((c) => getSeriesShowcase(c.id, c.coverImageId)),
  );
  const bioImageId = profileRow?.aboutImageId ?? profileRow?.heroImageId ?? null;

  const carouselPairs = await getHomeCarouselPairs();
  // Fallback（沒有任何系列湊得出「同系列兩張」時）：退回單張靜態圖，左右
  // 兩欄都放同一張——比起硬讓其中一欄空白，兩欄同圖至少畫面對稱、不突兀，
  // 跟這批之前「單張靜態圖」的既有 fallback 精神一致，只是套用到雙欄版面。
  const heroPairs =
    carouselPairs.length > 0
      ? carouselPairs
      : profileRow?.heroImageId && mediaMap.get(profileRow.heroImageId)
        ? [
            {
              left: { id: profileRow.heroImageId, r2Key: mediaMap.get(profileRow.heroImageId)!, altEn: null },
              right: { id: profileRow.heroImageId, r2Key: mediaMap.get(profileRow.heroImageId)!, altEn: null },
            },
          ]
        : [];

  const personImage = await resolveOgImageUrl(profileRow?.defaultOgImageId ?? profileRow?.heroImageId);
  const jsonLd = buildPersonJsonLd({
    nameEn: profileRow?.nameEn ?? "Tseng Yu Jui",
    nameZh: profileRow?.nameZh ?? null,
    roleEn: profileRow?.roleEn ?? null,
    roleZh: profileRow?.roleZh ?? null,
    locationEn: profileRow?.locationEn ?? null,
    locationZh: profileRow?.locationZh ?? null,
    bioEn: profileRow?.bioEn ?? null,
    bioZh: profileRow?.bioZh ?? null,
    email: profileRow?.email ?? null,
    instagram: profileRow?.instagram ?? null,
    behance: profileRow?.behance ?? null,
    imageUrl: personImage,
  });

  return (
    <LangPageWrapper navVariant="home">
      <script type="application/ld+json" {...jsonLdScriptProps(jsonLd)} />
      {/* 無障礙排查批次抓到（Lighthouse landmark-one-main）：全站沒有
          <main>，補在這裡——頁尾維持獨立的 <footer>，不包進來。 */}
      <main>
        <Hero
          nameEn={profileRow?.nameEn ?? ""}
          nameZh={profileRow?.nameZh ?? ""}
          roleEn={profileRow?.roleEn ?? null}
          roleZh={profileRow?.roleZh ?? null}
          locationEn={profileRow?.locationEn ?? null}
          locationZh={profileRow?.locationZh ?? null}
          pairs={heroPairs}
        />
        <SeriesSections
          items={publicCollections.map((c, i) => ({
            slug: c.slug,
            titleEn: c.titleEn,
            titleZh: c.titleZh,
            year: c.year,
            category: c.category,
            theme: c.theme ?? "dark",
            images: showcaseImages[i].map((img) => ({ r2Key: img.r2Key, altEn: img.altEn })),
          }))}
        />
        <BioSection
          bioEn={profileRow?.bioEn ?? null}
          bioZh={profileRow?.bioZh ?? null}
          imageR2Key={bioImageId ? (mediaMap.get(bioImageId) ?? null) : null}
        />
      </main>
      <SiteFooter
        email={profileRow?.email ?? null}
        instagram={profileRow?.instagram ?? null}
        nameEn={profileRow?.nameEn ?? ""}
      />
    </LangPageWrapper>
  );
}
