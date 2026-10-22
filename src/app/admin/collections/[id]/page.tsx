import { asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { collections, media } from "@/lib/db/schema";
import { galleryStyleFor } from "@/lib/collections/gallery-style";
import { sortGallery } from "@/lib/collections/gallery-order";
import { CollectionEditor, type CuratorItem } from "./collection-editor";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select({ titleEn: collections.titleEn, titleZh: collections.titleZh })
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);
  return { title: row ? (row.titleZh ?? row.titleEn) : "系列" };
}

/**
 * 系列編輯（2026-10-22 改版）。只放「真的會影響前台」的東西：基本資料、敘述、公開狀態
 * 與外觀、作品長廊（顯示哪些、什麼順序）、首頁輪播精選、封面與分享圖、內容提示。
 * 區塊編輯器（`./blocks`）的排版自 2026-09-21 起已不影響前台（系列頁直接讀圖庫），
 * 依業主決定從導覽收起，程式保留、網址仍可進入。
 */
export default async function AdminCollectionEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const { id } = await params;
  const [collectionRow] = await db.select().from(collections).where(eq(collections.id, id)).limit(1);
  if (!collectionRow) notFound();

  const [ownMedia, pickerMedia, collectionOptions] = await Promise.all([
    db
      .select({
        id: media.id,
        r2Key: media.r2Key,
        filename: media.filename,
        kind: media.kind,
        width: media.width,
        height: media.height,
        sortOrder: media.sortOrder,
        galleryOrder: media.galleryOrder,
        galleryHidden: media.galleryHidden,
        featuredOrder: media.featuredOrder,
      })
      .from(media)
      .where(eq(media.collectionId, id))
      .orderBy(asc(media.sortOrder)),
    db
      .select({
        id: media.id,
        r2Key: media.r2Key,
        filename: media.filename,
        kind: media.kind,
        collectionId: media.collectionId,
        altEn: media.altEn,
        altZh: media.altZh,
      })
      .from(media)
      .orderBy(asc(media.sortOrder)),
    db
      .select({ id: collections.id, titleEn: collections.titleEn, titleZh: collections.titleZh })
      .from(collections)
      .orderBy(asc(collections.sortOrder)),
  ]);

  const style = galleryStyleFor(collectionRow.theme);
  const ordered = sortGallery(ownMedia, style);
  const items: CuratorItem[] = ordered.map((m) => ({
    id: m.id,
    r2Key: m.r2Key,
    filename: m.filename,
    kind: m.kind,
    sortOrder: m.sortOrder,
    galleryOrder: m.galleryOrder,
    aspect: m.width && m.height ? m.width / m.height : 2 / 3,
  }));

  return (
    <CollectionEditor
      collection={collectionRow}
      items={items}
      initialGallery={{
        order: ordered.map((m) => m.id),
        custom: ordered.some((m) => m.galleryOrder !== null),
        hidden: ordered.filter((m) => m.galleryHidden).map((m) => m.id),
        featured: ownMedia
          .filter((m) => m.featuredOrder !== null && !m.galleryHidden)
          .sort((a, b) => (a.featuredOrder as number) - (b.featuredOrder as number))
          .map((m) => m.id),
      }}
      pickerMedia={pickerMedia}
      pickerCollections={collectionOptions.map((c) => ({ id: c.id, label: c.titleZh ?? c.titleEn }))}
    />
  );
}
