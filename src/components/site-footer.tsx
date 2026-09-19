import { langFontClass } from "@/components/lang";

/**
 * 全站共用頁尾——原本只在首頁用，定義在 `home-sections.tsx`；關於頁上線
 * 後變成第二個消費者，搬到這個中性位置（跟 `lang.tsx` 當初搬家理由一樣）。
 *
 * 文字色 `#808080`（原本 `#6B6B6B`，無障礙排查批次改的，見 HANDOFF.md）
 * ——`#6B6B6B` 在 `#0A0A0A` 背景上實測只有 3.72:1，這段文字（email/IG/
 * 版權）字級是 0.65rem，WCAG AA 一般文字門檻是 4.5:1，沒過。`#808080`
 * 是 5.01:1，通過門檻並留一點餘裕。
 */
export function SiteFooter({
  email,
  instagram,
  nameEn,
}: {
  email: string | null;
  instagram: string | null;
  nameEn: string;
}) {
  const year = new Date().getFullYear();
  return (
    <footer
      className="flex flex-col items-center gap-3 bg-[var(--ui-bg)] px-6 py-12 text-[var(--ui-muted)]"
      style={{ fontSize: "0.65rem", letterSpacing: "0.18em" }}
    >
      <div className={`flex flex-wrap items-center justify-center gap-4 ${langFontClass("en", "ui")}`}>
        {email && (
          <a href={`mailto:${email}`} className="hover:text-[var(--ui-fg)]">
            {email}
          </a>
        )}
        {instagram && (
          <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer" className="hover:text-[var(--ui-fg)]">
            @{instagram}
          </a>
        )}
      </div>
      <div className={langFontClass("en", "ui")}>
        © {year} {nameEn}
      </div>
    </footer>
  );
}
