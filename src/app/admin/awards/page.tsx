import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { awards, collections, media } from "@/lib/db/schema";
import { AwardsEditor } from "./awards-editor";

export const metadata = { title: "比賽經歷" };

export default async function AdminAwardsPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const [awardRows, pickerMedia, collectionRows] = await Promise.all([
    db
      .select({
        id: awards.id,
        year: awards.year,
        titleZh: awards.titleZh,
        titleEn: awards.titleEn,
        resultZh: awards.resultZh,
        resultEn: awards.resultEn,
        imageId: awards.imageId,
        showCertificate: awards.showCertificate,
      })
      .from(awards)
      .orderBy(asc(awards.sortOrder)),
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
    db.select({ id: collections.id, titleEn: collections.titleEn, titleZh: collections.titleZh }).from(collections).orderBy(asc(collections.sortOrder)),
  ]);

  return (
    <AwardsEditor
      initialAwards={awardRows}
      pickerMedia={pickerMedia}
      pickerCollections={collectionRows.map((c) => ({ id: c.id, label: c.titleZh ?? c.titleEn }))}
    />
  );
}
