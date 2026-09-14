import { asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasUnpublishedChanges } from "@/lib/blocks/publish";
import { db } from "@/lib/db/client";
import { blocks, collections, media } from "@/lib/db/schema";
import { BlockListClient } from "./block-list-client";

export default async function AdminCollectionBlocksPage({
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
    .select({
      id: collections.id,
      titleEn: collections.titleEn,
      titleZh: collections.titleZh,
      theme: collections.theme,
      publishedSnapshot: collections.publishedSnapshot,
      publishedAt: collections.publishedAt,
    })
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);

  if (!collectionRow) {
    notFound();
  }

  const [blockRows, mediaRows] = await Promise.all([
    db.select().from(blocks).where(eq(blocks.collectionId, id)).orderBy(asc(blocks.sortOrder)),
    db
      .select({
        id: media.id,
        r2Key: media.r2Key,
        filename: media.filename,
        kind: media.kind,
        altEn: media.altEn,
        altZh: media.altZh,
      })
      .from(media),
  ]);

  return (
    <BlockListClient
      collectionId={id}
      collectionTitle={collectionRow.titleZh ?? collectionRow.titleEn}
      theme={collectionRow.theme}
      initialBlocks={blockRows}
      mediaOptions={mediaRows}
      publishedAt={collectionRow.publishedAt}
      hasUnpublishedChanges={hasUnpublishedChanges(blockRows, collectionRow.publishedSnapshot)}
    />
  );
}
