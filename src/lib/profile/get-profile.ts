import { cache } from "react";
import { db } from "@/lib/db/client";
import { profile } from "@/lib/db/schema";

/**
 * `profile` 是 singleton 表，首頁／關於頁／`/work/[slug]` 的 JSON-LD
 * （需要 `creator` 連回 Person）都會各自查一次——用 `cache()` 包起來，
 * 同一個 request 內不管幾個地方呼叫都只真的打一次資料庫。
 *
 * 明確列欄位、不用 `db.select().from(profile)` 選整列——這支函式跟
 * `generateMetadata` 與頁面本體共用同一個 `cache()` promise，結構上跟
 * SEO 批次抓到的 `getPublishedCollection()` 洩漏（見該檔案註解）一模
 * 一樣（`cache()` + 多處共用 + 選整列）。`profile` 目前每個欄位本來就
 * 是「有值就打算公開」的內容，沒有 draft/consent 這種需要隱藏的欄位，
 * 所以今天沒有實際洩漏後果——但這批全專案排查的結論是不要依賴「今天
 * 沒有敏感欄位」這個事實，日後這張表如果加一個不該公開的欄位（例如
 * 內部備註），沒有人會想到要回來重新檢查這支函式的欄位範圍。明確列出
 * 目前所有消費端真的用到的欄位（除了 `id`、`updatedAt` 這兩個沒有任何
 * 消費端用到），新增欄位預設不會自動被這支函式帶出去。
 */
export const getProfile = cache(async () => {
  const [row] = await db
    .select({
      nameEn: profile.nameEn,
      nameZh: profile.nameZh,
      roleEn: profile.roleEn,
      roleZh: profile.roleZh,
      locationEn: profile.locationEn,
      locationZh: profile.locationZh,
      bioEn: profile.bioEn,
      bioZh: profile.bioZh,
      email: profile.email,
      instagram: profile.instagram,
      behance: profile.behance,
      heroImageId: profile.heroImageId,
      aboutImageId: profile.aboutImageId,
      seoTitle: profile.seoTitle,
      seoDescription: profile.seoDescription,
      defaultOgImageId: profile.defaultOgImageId,
    })
    .from(profile)
    .limit(1);
  return row ?? null;
});
