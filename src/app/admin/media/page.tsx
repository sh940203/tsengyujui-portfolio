import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { collections, media } from "@/lib/db/schema";
import { MediaLibraryClient } from "./media-library-client";

export default async function AdminMediaPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  const [mediaRows, collectionRows] = await Promise.all([
    db.select().from(media).orderBy(asc(media.kind), asc(media.sortOrder)),
    db
      .select({ id: collections.id, slug: collections.slug, titleEn: collections.titleEn })
      .from(collections)
      .orderBy(asc(collections.slug)),
  ]);

  return <MediaLibraryClient initialMedia={mediaRows} collections={collectionRows} />;
}
