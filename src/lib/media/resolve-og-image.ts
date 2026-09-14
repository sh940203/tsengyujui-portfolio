import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { ogImageUrl } from "@/lib/seo";

/** `cache()` 包起來——同一個 request 內 `generateMetadata` 跟頁面本體常常要解析同一個 media id，避免查兩次。 */
export const resolveOgImageUrl = cache(
  async (mediaId: string | null | undefined): Promise<string | undefined> => {
    if (!mediaId) return undefined;
    const [row] = await db.select({ r2Key: media.r2Key }).from(media).where(eq(media.id, mediaId)).limit(1);
    return row ? ogImageUrl(row.r2Key) : undefined;
  },
);
