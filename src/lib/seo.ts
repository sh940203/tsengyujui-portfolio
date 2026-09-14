/**
 * SEO 共用工具（SPEC.md §8、§1.2「禁止硬編碼網域」）。所有對外 URL 一律
 * 由 `NEXT_PUBLIC_SITE_URL` 組出，這個檔案是唯一讀這個環境變數的地方。
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

export function absoluteUrl(path: string): string {
  return SITE_URL ? `${SITE_URL}${path}` : path;
}

const OG_IMAGE_WIDTH = 1600;

/** 跟 `src/lib/media/image-loader.ts` 同一套邏輯，組出可直接被爬蟲/OG 讀取的圖片網址（不經過 next/image）。 */
export function ogImageUrl(r2Key: string): string | undefined {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!base) return undefined;
  return `${base}/${r2Key}/${OG_IMAGE_WIDTH}.webp`;
}

const META_DESCRIPTION_MAX = 155; // SPEC.md §8.1

export function truncateDescription(text: string): string {
  if (text.length <= META_DESCRIPTION_MAX) return text;
  return text.slice(0, META_DESCRIPTION_MAX - 1).trimEnd() + "…";
}

/**
 * 最後一層 fallback——連 `profile.seoDescription` 都是 `null` 時用（目前
 * 真實資料就是這個狀態）。不算「編造業主內容」，純粹是技術上「不留空
 * meta description」的通用站台描述，業主之後填了 `profile.seoDescription`
 * 就不會再用到這個值。
 */
export const GENERIC_SITE_DESCRIPTION =
  "Tseng Yu Jui — Fashion designer portfolio featuring collection lookbooks and design work.";

/** 安全序列化 JSON-LD，避免內容裡出現 `</script>` 之類的字元跳脫出 script 標籤。 */
export function jsonLdScriptProps(data: unknown) {
  return {
    dangerouslySetInnerHTML: {
      __html: JSON.stringify(data).replace(/</g, "\\u003c"),
    },
  };
}

/**
 * 濾掉 `null`/`undefined`/空字串的欄位，不遞迴（JSON-LD 這裡只有一層
 * 巢狀的 `homeLocation`，巢狀物件在呼叫端自己先組好、整包當一個值傳
 * 進來）。這是「缺值時該屬性直接不輸出，不要輸出 null 或空字串」
 * 這條規則唯一的把關點——`buildPersonJsonLd`/`buildCreativeWorkJsonLd`
 * 都刻意用可能為 `undefined` 的值組完整物件，最後統一交給這支濾掉。
 */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== ""),
  ) as T;
}

export interface PersonJsonLdInput {
  nameEn: string;
  nameZh: string | null;
  roleEn: string | null;
  roleZh: string | null;
  locationEn: string | null;
  locationZh: string | null;
  bioEn: string | null;
  bioZh: string | null;
  email: string | null;
  instagram: string | null;
  behance: string | null;
  imageUrl: string | undefined;
}

/** SPEC.md §8.3 / HANDOFF.md §7.2 的 Person 欄位對應表。 */
export function buildPersonJsonLd(input: PersonJsonLdInput) {
  const sameAs = [
    input.instagram ? `https://instagram.com/${input.instagram}` : null,
    input.behance ? `https://behance.net/${input.behance}` : null,
  ].filter((v): v is string => !!v);

  return compact({
    "@context": "https://schema.org",
    "@type": "Person",
    name: input.nameEn,
    alternateName: input.nameZh,
    jobTitle: input.roleEn ?? input.roleZh,
    // §7.2 標「待定用哪個屬性語意較準」——這批選 `homeLocation`：
    // `address` 隱含要給結構化的 PostalAddress，語意上太重，這裡只是
    // 「所在城市/地區」這種鬆散資訊，`homeLocation`（Place）比較貼切。
    homeLocation:
      input.locationEn || input.locationZh
        ? { "@type": "Place", name: input.locationEn ?? input.locationZh }
        : undefined,
    description: input.bioEn ?? input.bioZh,
    email: input.email,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
    image: input.imageUrl,
    url: SITE_URL || undefined,
  });
}

export interface CreativeWorkJsonLdInput {
  slug: string;
  titleEn: string;
  titleZh: string | null;
  statementEn: string | null;
  year: string | null;
  category: string | null;
  pieceCount: number | null;
  creatorNameEn: string;
  imageUrl: string | undefined;
}

/**
 * SPEC.md §8.3 / HANDOFF.md §7.2 的 CreativeWork 欄位對應表。`@type` 沿用
 * HANDOFF 標註的「最保守」選擇，型別本身待業主/SEO 顧問確認不是這批的
 * 範圍。`numberOfItems` 嚴格來說是 `ItemList`/`Collection` 的屬性，不是
 * `CreativeWork` 官方屬性——這個不精確是 HANDOFF §7.2 本來就標註過的已知
 * 取捨，這批照對應表實作、不重新設計；`pieceCount` 目前三系列都是
 * `null`，這個屬性在現有資料下不會真的輸出。
 */
export function buildCreativeWorkJsonLd(input: CreativeWorkJsonLdInput) {
  return compact({
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: input.titleEn,
    alternateName: input.titleZh,
    description: input.statementEn,
    dateCreated: input.year,
    creator: { "@type": "Person", name: input.creatorNameEn, url: SITE_URL || undefined },
    image: input.imageUrl,
    url: absoluteUrl(`/work/${input.slug}`),
    genre: input.category,
    numberOfItems: input.pieceCount ?? undefined,
  });
}
