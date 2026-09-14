import { asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { collections, media } from "@/lib/db/schema";
import { CollectionEditForm } from "./collection-edit-form";
import { FeaturedPhotosForm } from "./featured-photos-form";

export default async function AdminCollectionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  const { id } = await params;

  const [collectionRow] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);

  if (!collectionRow) {
    notFound();
  }

  const mediaRows = await db
    .select({ id: media.id, filename: media.filename, kind: media.kind })
    .from(media);

  const collectionMediaRows = await db
    .select({
      id: media.id,
      r2Key: media.r2Key,
      filename: media.filename,
      kind: media.kind,
      featuredOrder: media.featuredOrder,
    })
    .from(media)
    .where(eq(media.collectionId, id))
    .orderBy(asc(media.sortOrder));

  const initialFeaturedIds = collectionMediaRows
    .filter((m) => m.featuredOrder !== null)
    .sort((a, b) => (a.featuredOrder as number) - (b.featuredOrder as number))
    .map((m) => m.id);

  return (
    <>
      <CollectionEditForm collection={collectionRow} mediaOptions={mediaRows} />
      <div className="mx-auto max-w-2xl px-6 pb-6">
        <FeaturedPhotosForm
          collectionId={id}
          initialFeaturedIds={initialFeaturedIds}
          mediaOptions={collectionMediaRows}
        />
      </div>
    </>
  );
}
