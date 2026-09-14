import { langFontClass } from "@/components/lang";

/**
 * 全站共用頁尾——原本只在首頁用，定義在 `home-sections.tsx`；關於頁上線
 * 後變成第二個消費者，搬到這個中性位置（跟 `lang.tsx` 當初搬家理由一樣）。
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
      className="flex flex-col items-center gap-3 bg-[#0A0A0A] px-6 py-12 text-[#6B6B6B]"
      style={{ fontSize: "0.65rem", letterSpacing: "0.18em" }}
    >
      <div className={`flex flex-wrap items-center justify-center gap-4 ${langFontClass("en", "ui")}`}>
        {email && (
          <a href={`mailto:${email}`} className="hover:text-[#F2F3F4]">
            {email}
          </a>
        )}
        {instagram && (
          <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer" className="hover:text-[#F2F3F4]">
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
