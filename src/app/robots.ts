import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * 允許正常爬取，不特別排除任何路徑（含 `/admin`——已經有 middleware/
 * `requireAuth()` 擋著，不需要在這裡重複防禦；`unlisted` 系列的
 * per-page `noindex` 交給 `/work/[slug]` 自己的 `generateMetadata` 處理，
 * 不是 robots.txt 這層的責任）。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
