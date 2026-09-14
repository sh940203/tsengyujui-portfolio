import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { collections } from "@/lib/db/schema";
import { getProfile } from "@/lib/profile/get-profile";
import { absoluteUrl, truncateDescription } from "@/lib/seo";

/**
 * llms.txt（llmstxt.org 慣例，HANDOFF.md §7.1 已經定的內容範圍）。動態
 * 產生，不是靜態檔案——只列 `visibility === 'public'` 且已發布的系列
 * （跟 sitemap.ts、`/work/[slug]` 用同一條查詢原則，見決策記錄：
 * `unlisted` 語意上是「不公開列出」，llms.txt 本身就是一種列出，不收）。
 */
export async function GET() {
  const [profileRow, publicCollections] = await Promise.all([
    getProfile(),
    db
      .select({ slug: collections.slug, titleEn: collections.titleEn, statementEn: collections.statementEn })
      .from(collections)
      .where(and(eq(collections.visibility, "public"), isNotNull(collections.publishedSnapshot)))
      .orderBy(asc(collections.sortOrder)),
  ]);

  const nameEn = profileRow?.nameEn ?? "Tseng Yu Jui";
  const roleEn = profileRow?.roleEn ?? "Fashion Designer";

  const lines: string[] = [
    `# ${nameEn} — ${roleEn} Portfolio`,
    "",
    `> ${nameEn}, ${roleEn.toLowerCase()}, portfolio website.`,
    "",
    "## Pages",
    `- ${absoluteUrl("/")}: Home — hero, collection list, short bio`,
  ];

  for (const c of publicCollections) {
    const summary = c.statementEn ? truncateDescription(c.statementEn) : null;
    lines.push(
      summary
        ? `- ${absoluteUrl(`/work/${c.slug}`)}: ${c.titleEn} — ${summary}`
        : `- ${absoluteUrl(`/work/${c.slug}`)}: ${c.titleEn}`,
    );
  }

  lines.push(
    `- ${absoluteUrl("/about")}: About — full bio, awards, contact`,
    "",
    "## Notes",
    "- Bilingual content: English primary, Chinese secondary, both present in page HTML.",
    "- Draft and unlisted collections are not listed here; unlisted pages remain reachable by direct link but are intentionally excluded from this file.",
    "",
  );

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
