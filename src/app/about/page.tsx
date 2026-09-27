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
import { AboutBio, AwardsList, CertificateSection, ContactSection } from "./about-sections";

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
 * 關於頁（SPEC.md §4.4）：獲獎經歷（第一節，一進頁面就看到）→ 證書 → bio 全文 →
 * 聯絡資訊 → 頁尾。內容全部來自 `profile`（singleton）跟 `awards`，沒有草稿/發布
 * 機制（跟系列內頁不同，這頁不屬於任何 collection，沒有 visibility 這
 * 層過濾）。
 *
 * 2026-09-24：獲獎經歷原本是跑馬燈（動態），業主看過後回饋——關於頁要能「一目
 * 瞭然」，跑馬燈效果改放到首頁（見 `src/app/page.tsx`、`src/components/
 * awards-marquee.tsx`）。這裡改用純靜態、可直接掃視的 `AwardsList`（見
 * `about-sections.tsx`），沒有動效、不需要捲動或等待。
 *
 * 2026-09-27：業主再回饋「about 不用先秀名字，直接展示 awards」——原本開場的
 * 全螢幕姓名大字樣（`AboutIntro`）整段拿掉，`AwardsList` 直接是第一個內容區塊，
 * 順便把它的字級再放大（`about-sections.tsx` 開頭有完整說明）。姓名不是從頁面
 * 消失，只是不再用一整屏重複一次——首頁 Hero、頁尾姓名字樣、導覽都已經帶出姓名，
 * 這裡改用視覺隱藏的 `<h1 className="sr-only">` 保留頁面語意標題（SEO／
 * 螢幕閱讀器仍讀得到），不佔版面。
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

  // 只有證書圖需要查（`AboutIntro` 拿掉之後，`profileRow.aboutImageId` 不再有
  // 任何區塊會顯示，不放進來查——同這段註解一直以來「只查真的會用到的圖」的原則）。
  const imageIds = awardRows
    .map((a) => (a.showCertificate ? a.imageId : null))
    .filter((id): id is string => !!id);

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

  // 只有業主同意公開（showCertificate）且有圖、圖也查得到的獎項才放進證書區
  const certificates = awardRows.flatMap((a) => {
    const r2Key = a.showCertificate && a.imageId ? mediaMap.get(a.imageId) : null;
    if (!r2Key) return [];
    return [
      {
        id: a.id,
        year: a.year,
        titleEn: a.titleEn,
        titleZh: a.titleZh,
        resultEn: a.resultEn,
        resultZh: a.resultZh,
        r2Key,
        aspect: a.imageId ? (aspectMap.get(a.imageId) ?? null) : null,
      },
    ];
  });

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
        {/* 視覺隱藏：頁面仍需要一個語意 <h1>（SEO／螢幕閱讀器），但業主不要姓名
            佔用開場版面（見上方 2026-09-27 說明），所以不渲染任何看得見的樣子。 */}
        <h1 className="sr-only">
          {profileRow?.nameEn ?? "Tseng Yu Jui"}
          {profileRow?.nameZh ? ` ${profileRow.nameZh}` : ""} — About
        </h1>
        {/* 第一節：直接展示獲獎經歷，靜態清單、一目瞭然（沒有標題的獎項——理論上不會有——不放進去） */}
        <AwardsList
          items={awardRows
            .filter((a) => a.titleEn || a.titleZh)
            .map((a) => ({
              id: a.id,
              year: a.year,
              titleEn: a.titleEn,
              titleZh: a.titleZh,
              resultEn: a.resultEn,
              resultZh: a.resultZh,
            }))}
        />
        <CertificateSection items={certificates} />
        <AboutBio bioEn={profileRow?.bioEn ?? null} bioZh={profileRow?.bioZh ?? null} />
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
