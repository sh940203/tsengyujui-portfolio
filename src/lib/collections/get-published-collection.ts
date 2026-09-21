import { cache } from "react";
import { eq } from "drizzle-orm";
import { parsePublishedSnapshot, type PublishedSnapshot } from "@/lib/blocks/publish";
import { db } from "@/lib/db/client";
import { collections } from "@/lib/db/schema";

/**
 * 只列 `generateMetadata`／頁面本體真正會用到的欄位——**不要**改成
 * `db.select().from(collections)` 選整列。實測抓到一個真的洩漏：早期版本
 * 選整列（含 `publishedSnapshot` 原始 JSON、`consentNoteEn/Zh`、
 * `accentNote` 等內部欄位），`generateMetadata` 跟頁面本體都透過
 * `cache()` 共用同一個 promise，React Server Components 會把這個共用
 * promise 解析出的完整物件序列化進 RSC streaming payload（即使兩邊
 * 最後都呼叫 `notFound()`、visible 輸出只剩通用 404 metadata）——結果
 * draft 系列的完整內容（含尚未公開的 statement 全文、內容提示文案）
 * 還是會原封不動出現在 404 頁面的 HTML 原始碼裡，可以直接 view-source
 * 看到。只選真的要用的欄位，從根本上讓這個洩漏面不存在，不依賴
 * 「production build 會不會 strip 掉」這種不確定的假設。
 */
export interface PublishedCollectionRow {
  id: string;
  slug: string;
  titleEn: string;
  titleZh: string | null;
  statementEn: string | null;
  statementZh: string | null;
  year: string | null;
  category: string | null;
  pieceCount: number | null;
  theme: "dark" | "light" | "void";
  visibility: "public" | "unlisted" | "draft";
  ogImageId: string | null;
  coverImageId: string | null;
  requiresConsent: boolean;
  consentNoteEn: string | null;
  consentNoteZh: string | null;
  publishedAt: Date | null;
}

export interface PublishedCollection {
  row: PublishedCollectionRow;
  snapshot: PublishedSnapshot;
}

/**
 * `/work/[slug]` 的 `generateMetadata` 跟頁面本體都要做完全一樣的兩步
 * 404 判斷（見 `page.tsx` 開頭的說明：先 visibility、再 publishedSnapshot，
 * 順序不能顛倒）——如果只有頁面本體擋、`generateMetadata` 沒擋，草稿系列
 * 的標題/摘要會先被寫進 `<head>`（title、meta description、OG），即使頁面
 * 本身之後 404，view-source 還是看得到草稿內容，等於這批新加的 SEO
 * metadata 反而開了一個原本沒有的資料外洩缺口。用 `cache()` 包成單一
 * 共用函式，兩邊都呼叫這支、都各自對 `null` 結果呼叫 `notFound()`，
 * 同一個 request 內只會真的查一次資料庫。
 */
export const getPublishedCollection = cache(
  async (slug: string): Promise<PublishedCollection | null> => {
    const [row] = await db
      .select({
        id: collections.id,
        slug: collections.slug,
        titleEn: collections.titleEn,
        titleZh: collections.titleZh,
        statementEn: collections.statementEn,
        statementZh: collections.statementZh,
        year: collections.year,
        category: collections.category,
        pieceCount: collections.pieceCount,
        theme: collections.theme,
        visibility: collections.visibility,
        ogImageId: collections.ogImageId,
        coverImageId: collections.coverImageId,
        requiresConsent: collections.requiresConsent,
        consentNoteEn: collections.consentNoteEn,
        consentNoteZh: collections.consentNoteZh,
        publishedAt: collections.publishedAt,
        publishedSnapshot: collections.publishedSnapshot,
      })
      .from(collections)
      .where(eq(collections.slug, slug))
      .limit(1);

    if (!row) return null;
    if (row.visibility === "draft") return null;
    if (row.publishedSnapshot === null) return null;

    try {
      const snapshot = parsePublishedSnapshot(row.publishedSnapshot);
      const {
        id,
        slug,
        titleEn,
        titleZh,
        statementEn,
        statementZh,
        year,
        category,
        pieceCount,
        theme,
        visibility,
        ogImageId,
        coverImageId,
        requiresConsent,
        consentNoteEn,
        consentNoteZh,
        publishedAt,
      } = row;
      return {
        row: {
          id,
          slug,
          titleEn,
          titleZh,
          statementEn,
          statementZh,
          year,
          category,
          pieceCount,
          theme,
          visibility,
          ogImageId,
          coverImageId,
          requiresConsent,
          consentNoteEn,
          consentNoteZh,
          publishedAt,
        },
        snapshot,
      };
    } catch {
      return null;
    }
  },
);
