import Link from "next/link";
import { Lang, langFontClass } from "@/components/lang";
import { NAME_LOGOTYPE } from "@/lib/brand/name-logotype";

/**
 * 全站共用頁尾（首頁、關於頁）。
 *
 * 2026-09-20 改版：業主指定參考 aoiofficial.com——最底下放一個滿寬的超大
 * 姓名字樣，上面是幾組極小、字距拉開的連結。字樣圖用 CSS mask（不是
 * `<img>`）：顏色來自 `--ui-fg`，所以右上角淺色/深色切換時字樣跟著變色
 * （`<img>` 的 SVG 顏色是寫死的，得靠 filter 才能轉黑白，`mask` 直接吃
 * 背景色比較單純）。字樣圖還沒設的時候退回同樣尺度的文字。
 *
 * 需要放在 `LangPageWrapper`（提供 `data-lang`）底下，連結文字才有中英
 * 階層。文字色 `--ui-muted`：無障礙排查批次實測過對比度（深色 #808080
 * 5.01:1、淺色 #595959 6.3:1），見 HANDOFF.md。
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
  const logotype = NAME_LOGOTYPE.en;
  const linkClass = "w-fit hover:text-[var(--ui-fg)]";

  return (
    <footer className="bg-[var(--ui-bg)] px-6 pb-8 pt-[clamp(4rem,9vw,9rem)] text-[var(--ui-muted)] lg:px-16">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-[clamp(3rem,8vw,7rem)]">
        <div
          className={`grid gap-10 sm:grid-cols-2 ${langFontClass("en", "ui")}`}
          style={{ fontSize: "0.7rem", letterSpacing: "0.18em" }}
        >
          <nav aria-label="Footer" className="flex flex-col gap-3">
            <Link href="/#series" className={linkClass}>
              <Lang en="Work" zh="作品" role="ui" />
            </Link>
            <Link href="/about" className={linkClass}>
              <Lang en="About" zh="關於" role="ui" />
            </Link>
          </nav>
          <div className="flex flex-col gap-3 sm:items-end">
            {email && (
              <a href={`mailto:${email}`} className={linkClass}>
                {email}
              </a>
            )}
            {instagram && (
              <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer" className={linkClass}>
                @{instagram}
              </a>
            )}
          </div>
        </div>

        {logotype ? (
          <div
            role="img"
            aria-label={nameEn}
            style={{
              width: "100%",
              aspectRatio: logotype.aspect,
              backgroundColor: "var(--ui-fg)",
              WebkitMaskImage: `url(${logotype.src})`,
              maskImage: `url(${logotype.src})`,
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "left bottom",
              maskPosition: "left bottom",
            }}
          />
        ) : (
          <p
            className={`font-bold leading-none text-[var(--ui-fg)] ${langFontClass("en", "display")}`}
            style={{ fontSize: "clamp(3rem, 12vw, 12rem)", letterSpacing: "-0.02em" }}
          >
            {nameEn}
          </p>
        )}

        <div
          className={`flex flex-wrap justify-between gap-2 ${langFontClass("en", "ui")}`}
          style={{ fontSize: "0.65rem", letterSpacing: "0.18em" }}
        >
          <span>
            © {year} {nameEn}
          </span>
        </div>
      </div>
    </footer>
  );
}
