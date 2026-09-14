import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { extractMediaIds } from "@/lib/blocks/publish";
import { getPublishedCollection } from "@/lib/collections/get-published-collection";
import { db } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { resolveOgImageUrl } from "@/lib/media/resolve-og-image";
import { getProfile } from "@/lib/profile/get-profile";
import {
  GENERIC_SITE_DESCRIPTION,
  absoluteUrl,
  buildCreativeWorkJsonLd,
  jsonLdScriptProps,
  truncateDescription,
} from "@/lib/seo";
import { WorkPageClient } from "./work-page-client";

/**
 * 公開前台的系列內頁（SPEC.md §4.3）。查詢原則（已跟業主確認、不可顛倒）：
 *
 * 1. 先過 `visibility` 過濾——`draft` 一律視為不存在（404），不管有沒有
 *    發布過。`public`／`unlisted` 才繼續往下看。
 * 2. 通過 visibility 後才看 `publishedSnapshot` 有沒有內容——`null`
 *    代表這系列從沒發布過，一樣視為不存在（404），**不 fallback 去讀
 *    即時的 `blocks` 表**，否則等於沒做草稿/發布，會把編輯到一半的
 *    草稿內容曝光出去。
 *
 * 這兩條判斷順序不能顛倒、也不能讓其中一個覆蓋另一個判斷結果——
 * `visibility=public` 但沒發布過、或 `visibility=draft` 但發布過，都要
 * 各自正確處理，不能因為其中一個條件成立就跳過另一個。查詢本身搬到
 * `src/lib/collections/get-published-collection.ts`，`generateMetadata`
 * 跟這支頁面共用同一份判斷（見該檔案開頭說明——避免 metadata 洩漏草稿）。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await getPublishedCollection(slug);
  if (!found) notFound();
  const { row } = found;

  const description = row.statementEn
    ? truncateDescription(row.statementEn)
    : GENERIC_SITE_DESCRIPTION;
  const image = await resolveOgImageUrl(row.ogImageId ?? row.coverImageId);

  return {
    // 根 layout 的 `template: "%s — Tseng Yu Jui"` 會自動補上後綴——這裡
    // 只回傳系列標題本身，不要在這裡再拼一次「— Tseng Yu Jui」，不然會
    // 疊成 "titleEn — Tseng Yu Jui — Tseng Yu Jui"（實測抓到的）。
    title: row.titleEn,
    description,
    alternates: { canonical: absoluteUrl(`/work/${row.slug}`) },
    openGraph: {
      title: row.titleEn,
      description,
      url: absoluteUrl(`/work/${row.slug}`),
      type: "article",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: row.titleEn,
      description,
      images: image ? [image] : undefined,
    },
    // SPEC.md §8.1：unlisted 不索引但可直接連結；public 正常索引。draft
    // 已經在 getPublishedCollection() 被擋掉，走不到這裡。
    robots: row.visibility === "unlisted" ? "noindex, nofollow" : "index, follow",
  };
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await getPublishedCollection(slug);
  if (!found) notFound();
  const { row, snapshot } = found;

  // 只查這個系列快照裡真的引用到的 media，不是抓全站 media——原本沒有
  // `where`，會把其他系列（含草稿）的 `r2Key`/`filename` 也一起撈出來，
  // 見 `extractMediaIds()` 註解跟 SEO 批次全專案排查的結論。
  const neededMediaIds = extractMediaIds(snapshot);
  const [mediaRows, profileRow, image] = await Promise.all([
    neededMediaIds.length > 0
      ? db
          .select({
            id: media.id,
            r2Key: media.r2Key,
            filename: media.filename,
            altEn: media.altEn,
            altZh: media.altZh,
          })
          .from(media)
          .where(inArray(media.id, neededMediaIds))
      : Promise.resolve([]),
    getProfile(),
    resolveOgImageUrl(row.ogImageId ?? row.coverImageId),
  ]);

  const jsonLd = buildCreativeWorkJsonLd({
    slug: row.slug,
    titleEn: row.titleEn,
    titleZh: row.titleZh,
    statementEn: row.statementEn,
    year: row.year,
    category: row.category,
    pieceCount: row.pieceCount,
    creatorNameEn: profileRow?.nameEn ?? "Tseng Yu Jui",
    imageUrl: image,
  });

  return (
    <>
      <script type="application/ld+json" {...jsonLdScriptProps(jsonLd)} />
      <WorkPageClient
        slug={slug}
        theme={row.theme}
        titleEn={row.titleEn}
        titleZh={row.titleZh}
        requiresConsent={row.requiresConsent}
        consentNoteEn={row.consentNoteEn}
        consentNoteZh={row.consentNoteZh}
        blocks={snapshot.map((block) => ({
          id: block.id,
          type: block.type,
          config: block.config as Record<string, unknown>,
        }))}
        mediaOptions={mediaRows}
      />
    </>
  );
}
