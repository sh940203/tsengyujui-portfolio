import { asc, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { awards, collections, media, profile } from "@/lib/db/schema";
import { MediaLibraryClient, type LibraryItem } from "./media-library-client";

export const metadata = { title: "圖庫" };

/**
 * 圖庫（2026-10-22 改版）。除了圖片本身，也算出每張圖「目前被哪裡使用」（系列封面/分享圖/
 * 首頁精選、個人資料的圖、關於頁證書）——2026-09 曾經差點把「沒有指派系列」的關於頁證書
 * 當成沒用的圖刪掉，刪除前一定要看得到這張圖在哪裡被用到。
 */
export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; upload?: string; collection?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const params = await searchParams;

  const [mediaRows, collectionRows, profileRows, awardRows] = await Promise.all([
    db
      .select({
        id: media.id,
        r2Key: media.r2Key,
        filename: media.filename,
        width: media.width,
        height: media.height,
        fileSize: media.fileSize,
        rotation: media.rotation,
        focalX: media.focalX,
        focalY: media.focalY,
        altEn: media.altEn,
        altZh: media.altZh,
        kind: media.kind,
        collectionId: media.collectionId,
        galleryHidden: media.galleryHidden,
        featuredOrder: media.featuredOrder,
        createdAt: media.createdAt,
      })
      .from(media)
      .orderBy(desc(media.createdAt), asc(media.sortOrder)),
    db
      .select({
        id: collections.id,
        titleEn: collections.titleEn,
        titleZh: collections.titleZh,
        coverImageId: collections.coverImageId,
        ogImageId: collections.ogImageId,
        titleImageId: collections.titleImageId,
      })
      .from(collections)
      .orderBy(asc(collections.sortOrder)),
    db
      .select({ heroImageId: profile.heroImageId, aboutImageId: profile.aboutImageId, defaultOgImageId: profile.defaultOgImageId })
      .from(profile)
      .where(eq(profile.id, "singleton")),
    db.select({ imageId: awards.imageId, titleZh: awards.titleZh, titleEn: awards.titleEn, showCertificate: awards.showCertificate }).from(awards),
  ]);

  const usage = new Map<string, string[]>();
  const addUsage = (id: string | null, label: string) => {
    if (!id) return;
    usage.set(id, [...(usage.get(id) ?? []), label]);
  };
  for (const c of collectionRows) {
    const name = c.titleZh ?? c.titleEn;
    addUsage(c.coverImageId, `「${name}」封面`);
    addUsage(c.ogImageId, `「${name}」分享圖`);
    addUsage(c.titleImageId, `「${name}」標題圖`);
  }
  const p = profileRows[0];
  if (p) {
    addUsage(p.heroImageId, "個人資料：首頁備援圖");
    addUsage(p.aboutImageId, "個人資料：關於頁照片");
    addUsage(p.defaultOgImageId, "個人資料：預設分享圖");
  }
  for (const a of awardRows) {
    addUsage(a.imageId, `獎項證書「${a.titleZh ?? a.titleEn}」${a.showCertificate ? "（關於頁公開中）" : ""}`);
  }
  const collectionName = new Map(collectionRows.map((c) => [c.id, c.titleZh ?? c.titleEn]));
  for (const m of mediaRows) {
    if (m.featuredOrder !== null && m.collectionId && !m.galleryHidden) {
      addUsage(m.id, `「${collectionName.get(m.collectionId)}」首頁輪播精選`);
    }
  }

  const items: LibraryItem[] = mediaRows.map((m) => ({
    ...m,
    createdAt: m.createdAt.getTime(),
    usage: usage.get(m.id) ?? [],
  }));

  return (
    <MediaLibraryClient
      initialItems={items}
      collections={collectionRows.map((c) => ({ id: c.id, label: c.titleZh ?? c.titleEn }))}
      initialFilter={params.filter === "missing-alt" ? "missing-alt" : null}
      initialCollection={params.collection ?? null}
      openUpload={params.upload === "1"}
    />
  );
}
