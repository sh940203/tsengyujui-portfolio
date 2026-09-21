import type { Metadata } from "next";
import { asc, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { awards, media } from "@/lib/db/schema";
import { resolveOgImageUrl } from "@/lib/media/resolve-og-image";
import { getProfile } from "@/lib/profile/get-profile";
import {
  GENERIC_SITE_DESCRIPTION,
  absoluteUrl,
  buildPersonJsonLd,
  jsonLdScriptProps,
  truncateDescription,
} from "@/lib/seo";
import { LangPageWrapper } from "@/components/lang-page-wrapper";
import { SiteFooter } from "@/components/site-footer";
import { AboutBio, AboutHeader, AwardsList, ContactSection } from "./about-sections";

export async function generateMetadata(): Promise<Metadata> {
  const profileRow = await getProfile();
  const description = profileRow?.seoDescription
    ? truncateDescription(profileRow.seoDescription)
    : profileRow?.bioEn
      ? truncateDescription(profileRow.bioEn)
      : GENERIC_SITE_DESCRIPTION;
  const image = await resolveOgImageUrl(profileRow?.defaultOgImageId ?? profileRow?.aboutImageId);

  return {
    title: "About",
    description,
    alternates: { canonical: absoluteUrl("/about") },
    openGraph: {
      title: `About — ${profileRow?.nameEn ?? "Tseng Yu Jui"}`,
      description,
      url: absoluteUrl("/about"),
      type: "profile",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `About — ${profileRow?.nameEn ?? "Tseng Yu Jui"}`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

/**
 * 關於頁（SPEC.md §4.4）：頭像/姓名 → bio 全文 → 比賽經歷 → 聯絡資訊 →
 * 頁尾。內容全部來自 `profile`（singleton）跟 `awards`，沒有草稿/發布
 * 機制（跟系列內頁不同，這頁不屬於任何 collection，沒有 visibility 這
 * 層過濾）。
 */
export default async function AboutPage() {
  const profileRow = await getProfile();
  // 明確列欄位、不選整列——見 SEO 批次的全專案排查結論（`src/lib/profile/
  // get-profile.ts` 開頭註解）：這裡雖然不是 `cache()` 共用查詢（單一
  // Server Component 內一次性 await，實測過不會有那支的洩漏機制），
  // 但 `imageId`/`showCertificate` 本來就是「業主決定要不要公開」的
  // 把關欄位，跟只選必要欄位的原則一致，不留下日後被誤用的欄位範圍。
  const awardRows = await db
    .select({
      id: awards.id,
      year: awards.year,
      titleEn: awards.titleEn,
      titleZh: awards.titleZh,
      resultEn: awards.resultEn,
      resultZh: awards.resultZh,
      imageId: awards.imageId,
      showCertificate: awards.showCertificate,
    })
    .from(awards)
    .orderBy(asc(awards.sortOrder));

  const imageIds = [
    profileRow?.aboutImageId,
    ...awardRows.map((a) => (a.showCertificate ? a.imageId : null)),
  ].filter((id): id is string => !!id);

  // 只查真的需要的幾張圖，不是抓全站 media——原本 `db.select(...).from(media)`
  // 沒有 `where`，會把包括草稿系列在內的每一筆 media 的 `r2Key` 都撈出來，
  // 雖然目前沒有實測出這些額外資料會外洩（不是 `cache()` 共用查詢），
  // 但公開頁面沒理由查超出畫面會用到的資料列，順手一起收斂。
  const mediaMap = new Map<string, string>();
  // 寬 ÷ 高（已是旋轉後的尺寸）：證書是文件，要用真實比例完整顯示，不能裁切
  const aspectMap = new Map<string, number>();
  if (imageIds.length > 0) {
    const mediaRows = await db
      .select({ id: media.id, r2Key: media.r2Key, width: media.width, height: media.height })
      .from(media)
      .where(inArray(media.id, imageIds));
    for (const row of mediaRows) {
      mediaMap.set(row.id, row.r2Key);
      if (row.width && row.height) aspectMap.set(row.id, row.width / row.height);
    }
  }

  const personImage = await resolveOgImageUrl(profileRow?.defaultOgImageId ?? profileRow?.aboutImageId);
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
    <LangPageWrapper navVariant="about">
      <script type="application/ld+json" {...jsonLdScriptProps(jsonLd)} />
      {/* 無障礙排查批次抓到（Lighthouse landmark-one-main）：全站沒有
          <main>，補在這裡——頁尾維持獨立的 <footer>，不包進來。 */}
      <main>
        <AboutHeader
          nameEn={profileRow?.nameEn ?? ""}
          nameZh={profileRow?.nameZh ?? ""}
          roleEn={profileRow?.roleEn ?? null}
          roleZh={profileRow?.roleZh ?? null}
          imageR2Key={profileRow?.aboutImageId ? (mediaMap.get(profileRow.aboutImageId) ?? null) : null}
        />
        <AboutBio bioEn={profileRow?.bioEn ?? null} bioZh={profileRow?.bioZh ?? null} />
        <AwardsList
          items={awardRows.map((a) => ({
            id: a.id,
            year: a.year,
            titleEn: a.titleEn,
            titleZh: a.titleZh,
            resultEn: a.resultEn,
            resultZh: a.resultZh,
            certificateR2Key:
              a.showCertificate && a.imageId ? (mediaMap.get(a.imageId) ?? null) : null,
            certificateAspect: a.imageId ? (aspectMap.get(a.imageId) ?? null) : null,
          }))}
        />
        <ContactSection
          email={profileRow?.email ?? null}
          instagram={profileRow?.instagram ?? null}
          behance={profileRow?.behance ?? null}
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
