import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { collections, media, profile } from "@/lib/db/schema";
import { ProfileEditForm } from "./profile-edit-form";

export const metadata = { title: "個人資料" };

export default async function AdminProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const [[profileRow], pickerMedia, collectionRows] = await Promise.all([
    db.select().from(profile).where(eq(profile.id, "singleton")).limit(1),
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

  if (!profileRow) {
    // seed-content.ts 應該已經建過這筆單一紀錄；理論上不會發生
    throw new Error("profile singleton 尚不存在，請先執行 pnpm run seed");
  }

  return (
    <ProfileEditForm
      profile={profileRow}
      pickerMedia={pickerMedia}
      pickerCollections={collectionRows.map((c) => ({ id: c.id, label: c.titleZh ?? c.titleEn }))}
    />
  );
}
