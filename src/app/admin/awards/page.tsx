import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { awards, media } from "@/lib/db/schema";
import { AwardCertificateToggle, AwardImagePicker } from "./award-image-picker";

export default async function AdminAwardsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  const [awardRows, mediaRows] = await Promise.all([
    db.select().from(awards).orderBy(asc(awards.sortOrder)),
    db
      .select({ id: media.id, filename: media.filename, kind: media.kind })
      .from(media),
  ]);

  return (
    <main>
      <h1>比賽經歷</h1>
      <table>
        <thead>
          <tr>
            <th>年份</th>
            <th>名稱</th>
            <th>成果</th>
            <th>圖片</th>
            <th>證書</th>
          </tr>
        </thead>
        <tbody>
          {awardRows.map((award) => (
            <tr key={award.id}>
              <td>{award.year}</td>
              <td>{award.titleZh ?? award.titleEn}</td>
              <td>{award.resultZh ?? award.resultEn}</td>
              <td>
                <AwardImagePicker
                  awardId={award.id}
                  currentImageId={award.imageId}
                  mediaOptions={mediaRows}
                />
              </td>
              <td>
                <AwardCertificateToggle awardId={award.id} showCertificate={award.showCertificate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
