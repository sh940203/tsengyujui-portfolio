import { asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { blocks, collections, media } from "@/lib/db/schema";
import type { BlockType } from "@/lib/blocks/schemas";
import { PreviewClient } from "./preview-client";

/**
 * 只給 Block Editor 的 iframe 內嵌用（`block-list-client.tsx`），不是給人
 * 直接連結瀏覽的頁面——SSR 這裡查出來的只是「目前資料庫存檔的內容」，開
 * 著分頁編輯時真正跟著打字即時更新的部分是靠 postMessage（見
 * preview-client.tsx），SSR 資料只當作 JS 還沒跑起來前的第一次畫面。
 *
 * `requireAuth()` 同 blocks/page.tsx 的既有慣例逐頁檢查，middleware 不是
 * 唯一防線（SPEC.md §12.2）；X-Frame-Options: SAMEORIGIN 已經是
 * next.config.ts 全站套用的標頭（SPEC §12.7），這裡不用另外加。
 */
export default async function CollectionPreviewPage({
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
    .select({ theme: collections.theme })
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);

  if (!collectionRow) {
    notFound();
  }

  const [blockRows, mediaRows] = await Promise.all([
    db
      .select({ id: blocks.id, type: blocks.type, config: blocks.config })
      .from(blocks)
      .where(eq(blocks.collectionId, id))
      .orderBy(asc(blocks.sortOrder)),
    db.select({ id: media.id, r2Key: media.r2Key, filename: media.filename }).from(media),
  ]);

  return (
    <PreviewClient
      initialTheme={collectionRow.theme}
      initialBlocks={blockRows.map((b) => ({
        id: b.id,
        type: b.type as BlockType,
        config: JSON.parse(b.config) as Record<string, unknown>,
      }))}
      initialMediaOptions={mediaRows}
    />
  );
}
