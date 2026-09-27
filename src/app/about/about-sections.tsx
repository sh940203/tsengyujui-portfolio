import Image from "next/image";
import type { CSSProperties } from "react";
import { Lang, langFontClass } from "@/components/lang";

/**
 * 關於頁的內容區塊（SPEC.md §4.4：bio 全文、比賽經歷、關於頁圖片、聯絡資訊）。
 * 跟首頁一樣固定用介面黑灰白（SPEC §5.1），跟著右上角淺色/深色切換，不跟任何系列的
 * theme 走——關於頁不屬於任何系列。
 *
 * 2026-09-27：業主回饋「about 不用先秀名字，直接展示 awards」——原本第一節是全螢幕的
 * 姓名大字樣（`AboutIntro`／`NameLine`，跟首頁 Hero 同一套三段進場），現在整段拿掉，
 * `AwardsList` 直接是頁面第一個內容區塊。姓名不是完全消失：首頁 Hero、頁尾姓名字樣、
 * 導覽的「About」連結都已經帶出姓名脈絡，這頁不需要再重複一次大字樣；`AboutPage`
 * （`about/page.tsx`）改放一個 `sr-only` 的 `<h1>` 保留頁面語意標題（SEO／螢幕閱讀器），
 * 不佔視覺版面。
 * - 其餘區塊都是首頁系列區塊那種 12 欄格線：左欄（桌機 `sticky`）放標題、右欄放內容。
 *
 * 2026-09-24：獲獎經歷原本是跑馬燈，業主看過後回饋「關於頁要一目瞭然」，跑馬燈效果
 * 改搬去首頁（`src/components/awards-marquee.tsx`）。這裡的 `AwardsList` 是純靜態
 * 清單——沒有動效、不用等待或捲動就能看完全部獎項，跟 `ContactSection` 同一種
 * 「一列一列、`border-current` 分隔線」的版面語言。2026-09-27 再放大字級（業主原話
 * 「把字秀清楚，大字，年份也清楚，畫面乾淨」）：獎項名稱改用跟系列標題同一套
 * `series-title-lang`（英文在上、中文在下，可換行，不會像跑馬燈那樣硬擠成一行），
 * 年份獨立一行、字級與不透明度都提高，成績標籤跟年份同一行、靠右對齊。
 *
 * 真實資料狀態本來就大量留空（bio、關於頁圖片、信箱、IG 都還沒填），所以每個區塊都
 * 刻意做成「沒資料就整段不渲染」，不是為了測試才這樣寫。
 *
 * 2026-09-27（再一版）：業主看過大字級版本後回饋「名次要跳色」＋「排版有點擁擠，
 * 字距離開一些，但不能損失太多字體大小」——
 * - **名次跳色**：`AwardResult` 的成績標籤（First Place / Winner…）從原本跟標題
 *   同色的外框，改成金色系（`--award-accent`，`globals.css` 定義，深色/淺色主題
 *   各自一組數值維持對比度）。這是刻意偏離 SPEC §5.1「介面僅黑灰白三色系」的例外，
 *   業主本人要求，範圍只限這一個徽章，不擴大到其他 UI 元件。
 * - **排版擁擠**：問題不是字級本身，是（1）中文在大字級下沒有額外字距，方塊字彼此
 *   貼太緊，（2）每列的行距／上下留白偏窄。沒有縮小任何 `clamp()` 的字級數字——
 *   加了 `.award-title-spaced`（`globals.css`，疊在 `series-title-lang` 之上，只
 *   影響這裡，不動全站共用的 `series-title-lang`）：中文字距開到 0.06em、英文
 *   0.01em、中英文之間的垂直間距加大；同時把每列的行高（1.05→1.2）、列與列之間
 *   的間距（`gap-4`→`gap-5 lg:gap-6`）、上下留白（`py-8/10`→`py-10/14`）都放寬。
 *
 * 2026-09-28：業主回饋「字太擠了，我要一行能看完」——實際看到的是沒有英文譯名的
 * 獎項（`AwardTitle` 的退回分支，佔目前 4 筆裡的 3 筆），原本完全沒有任何換行
 * 控制，長標題（例如「嶺東科技大學服飾設計系第七屆畢業展」17 字）用瀏覽器預設
 * 斷行硬切成兩行。固定的 vw 相對字級（clamp）不知道內容多長，短標題留白很多、
 * 長標題卻在同一個字級下被擠到換行。改用 CSS Container Query（`.award-list` 掛
 * `container-type: inline-size`，`globals.css`）讓字級「量身訂做」——每個標題
 * 自己算出「剛好塞滿這一欄寬度、不換行」的字級，字數少的維持大字級（原本的
 * 上限 4rem 沒變），字數多的自動縮小到能塞進一行為止，不用為每個斷點手動調
 * 數字（`cqi` 直接反映該欄在目前螢幕寬度下的實際寬度）。標題的字數
 * （`titleEn.length`/`titleZh.length`）算好後透過 `--en-chars`/`--zh-chars` 兩個
 * CSS 自訂屬性帶給 `globals.css` 的公式使用，實作細節見該檔案的對應註解。
 */

const META_STYLE = { fontSize: "0.7rem", letterSpacing: "0.18em" } as const;
const SECTION_PAD = "px-6 py-[clamp(4rem,9vw,9rem)] lg:px-16";
const GRID = "mx-auto grid max-w-[90rem] gap-x-[clamp(1.5rem,4vw,4rem)] gap-y-10 lg:grid-cols-12";

/** 左欄標題：跟首頁「Selected work / 作品」同一個字級與雙語排法。 */
function SectionHeading({ en, zh }: { en: string; zh: string }) {
  return (
    <div className="lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
      <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", letterSpacing: "-0.01em" }}>
        <Lang en={en} zh={zh} role="display" className="series-title-lang" />
      </h2>
    </div>
  );
}

export interface AwardListItem {
  id: string;
  year: string;
  titleEn: string | null;
  titleZh: string | null;
  resultEn: string | null;
  resultZh: string | null;
}

/**
 * 官方英文譯名待補的獎項（`titleEn` 為 `null`）不用雙語主從機制去湊——硬塞進 `Lang`
 * 會讓同一段中文一大一小疊兩次。缺英文版就直接顯示中文原文一次，不管目前是哪個
 * 語言模式（不編造英譯，同全站慣例，見 `src/components/awards-marquee.tsx` 的
 * 同一條規則）。用 `series-title-lang`（首頁系列標題同一套）而不是 `lang-pair`：
 * 大字級下兩語言硬擠一行會太寬甚至超出欄位，`series-title-lang` 讓主要語言在上、
 * 次要語言在下，各自可以換行（`text-wrap: balance`），長標題（例如「嶺東科技大學
 * 服飾設計系第七屆畢業展」）也不會頂出版面。額外疊 `award-title-spaced`
 * （`globals.css`）只加開字距與行距，不動 `series-title-lang` 本身（那個 class
 * 全站共用，改了會動到首頁系列標題）。
 */
function AwardTitle({ titleEn, titleZh }: { titleEn: string | null; titleZh: string | null }) {
  if (titleEn) {
    return (
      <Lang en={titleEn} zh={titleZh ?? ""} role="display" className="series-title-lang award-title-spaced" />
    );
  }
  return (
    <span className={langFontClass("zh", "display")} style={{ letterSpacing: "0.06em" }}>
      {titleZh}
    </span>
  );
}

/**
 * 名次／成績標籤——業主要求「跳色」：從跟標題同色的外框，改成金色系
 * `--award-accent`（`globals.css`，深色/淺色主題各自一組數值，維持 WCAG AA
 * 對比度）。刻意偏離 SPEC §5.1「介面僅黑灰白三色系」，範圍只限這一個徽章。
 */
function AwardResult({ resultEn, resultZh }: { resultEn: string | null; resultZh: string | null }) {
  if (!resultEn && !resultZh) return null;
  return (
    <span
      className="lang-readable inline-flex shrink-0 items-center rounded-full border px-4 py-2"
      style={{
        fontSize: "0.85rem",
        letterSpacing: "0.12em",
        color: "var(--award-accent)",
        borderColor: "var(--award-accent)",
        backgroundColor: "color-mix(in srgb, var(--award-accent) 14%, transparent)",
      }}
    >
      {resultEn ? (
        <Lang en={resultEn} zh={resultZh ?? ""} role="ui" />
      ) : (
        <span className={langFontClass("zh", "ui")}>{resultZh}</span>
      )}
    </span>
  );
}

/**
 * 獲獎經歷——關於頁第一節、一進頁面就直接看到（2026-09-27，取代原本開場的姓名
 * 大字樣，見檔案開頭說明）。一目瞭然的靜態清單：沒有動效、不用點進任何地方、
 * 不用等待或捲動就能看完全部獎項。跟 `ContactSection` 同一種版面語言——
 * 一列一列、`border-current/15` 分隔線——但這裡刻意放大到跟系列標題同一個量級
 * （業主原話「把字秀清楚，大字，年份也清楚，畫面乾淨」）：每一列拆成上下兩行，
 * 上排是年份＋成績（小而清楚、獨立一行不會被長標題擠壓），下排是獎項名稱
 * （巨大字級，跟首頁系列標題、跑馬燈同一個視覺量級，但不做動態捲動）。
 * `pt-28`/`lg:pt-32`：這是頁面的第一個區塊，要留出跟原本 `AboutIntro` 一樣的
 * 空間，不被固定在畫面上的左上導覽／右上語言切換鈕蓋住。
 */
export function AwardsList({ items }: { items: AwardListItem[] }) {
  if (items.length === 0) return null;
  return (
    <section id="awards" className="bg-[var(--ui-bg)] px-6 pt-28 pb-[clamp(4rem,9vw,9rem)] text-[var(--ui-fg)] lg:px-16 lg:pt-32">
      <div className={GRID}>
        <SectionHeading en="Awards" zh="獲獎經歷" />
        {/* `award-list`：CSS container（`globals.css`），讓標題的 `cqi` 字級公式量到
            這一欄的實際寬度，不是整個視窗寬度。 */}
        <ul className="award-list flex flex-col lg:col-span-8">
          {items.map((item) => (
            <li key={item.id} className="border-t border-current/15 last:border-b">
              <div className="flex flex-col gap-5 py-10 lg:gap-6 lg:py-14">
                <div className={`flex flex-wrap items-center justify-between gap-4 ${langFontClass("en", "ui")}`}>
                  <span style={{ fontSize: "clamp(0.9rem, 1.5vw, 1.1rem)", letterSpacing: "0.16em", opacity: 0.85 }}>
                    {item.year}
                  </span>
                  <AwardResult resultEn={item.resultEn} resultZh={item.resultZh} />
                </div>
                <div
                  className={item.titleEn ? "award-fit-title" : "award-fit-title-solo"}
                  style={
                    {
                      lineHeight: 1.2,
                      "--en-chars": item.titleEn?.length || 1,
                      "--zh-chars": item.titleZh?.length || 1,
                    } as CSSProperties
                  }
                >
                  <AwardTitle titleEn={item.titleEn} titleZh={item.titleZh} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export interface CertificateItem {
  id: string;
  year: string;
  titleEn: string | null;
  titleZh: string | null;
  resultEn: string | null;
  resultZh: string | null;
  r2Key: string;
  /** 證書的寬 ÷ 高；沒有就退回 3:4（直式證書的常見比例）。 */
  aspect: number | null;
}

/**
 * 證書（只有業主同意公開的、`awards.showCertificate` 為真且有圖的獎項）。證書是文件：
 * 用它真實的比例完整顯示（`contain`），不能裁切——原本固定 4:3 加 `cover`，直式證書上下的字與
 * 印章被裁掉，手機截圖實測抓到。獎項本身的名稱/年份/成績已經在跑馬燈，這裡只補證書圖與一行說明。
 */
export function CertificateSection({ items }: { items: CertificateItem[] }) {
  if (items.length === 0) return null;
  return (
    <section id="certificate" className={`bg-[var(--ui-bg)] text-[var(--ui-fg)] ${SECTION_PAD}`}>
      <div className={GRID}>
        <SectionHeading en="Certificate" zh="證書" />
        <div className="grid gap-x-[clamp(1.5rem,4vw,4rem)] gap-y-12 sm:grid-cols-2 lg:col-span-8">
          {items.map((item) => (
            <figure key={item.id} className="group flex flex-col gap-5">
              <div
                className="relative w-full max-w-[26rem] overflow-hidden border border-current/15 bg-white/5"
                style={{ aspectRatio: item.aspect ?? 3 / 4 }}
              >
                <Image
                  src={item.r2Key}
                  alt={item.titleEn ?? item.titleZh ?? ""}
                  fill
                  sizes="(max-width: 640px) 88vw, (max-width: 1024px) 44vw, 26rem"
                  style={{ objectFit: "contain" }}
                  className="motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.03]"
                />
              </div>
              <figcaption className="lang-readable flex flex-col gap-1.5" style={{ fontSize: "0.95rem", lineHeight: 1.6 }}>
                <span className={`opacity-70 ${langFontClass("en", "ui")}`} style={META_STYLE}>
                  {item.year}
                </span>
                {item.titleEn ? (
                  <Lang en={item.titleEn} zh={item.titleZh ?? ""} role="ui" className="statement-stack" style={{ gap: "0.25rem" }} />
                ) : (
                  <span className={langFontClass("zh", "ui")}>{item.titleZh}</span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AboutBio({ bioEn, bioZh }: { bioEn: string | null; bioZh: string | null }) {
  if (!bioEn && !bioZh) return null;
  return (
    <section id="bio" className={`bg-[var(--ui-bg)] text-[var(--ui-fg)] ${SECTION_PAD}`}>
      <div className={GRID}>
        <SectionHeading en="Bio" zh="簡介" />
        <div className="lg:col-span-8">
          {/* 大字級的簡介：英文為主時英文在上、中文在下（`statement-stack` 依語言模式排序），
              保留原始換行（`Lang` 已經是 `pre-line`）。 */}
          <Lang
            en={bioEn ?? ""}
            zh={bioZh ?? ""}
            role="ui"
            className="statement-stack lang-readable"
            style={{ fontSize: "clamp(1.25rem, 2.4vw, 2.1rem)", lineHeight: 1.5, letterSpacing: "-0.005em" }}
          />
        </div>
      </div>
    </section>
  );
}

export function ContactSection({
  email,
  instagram,
  behance,
}: {
  email: string | null;
  instagram: string | null;
  behance: string | null;
}) {
  if (!email && !instagram && !behance) return null;

  const rows: { key: string; label: string; text: string; href: string; external: boolean }[] = [];
  if (email) rows.push({ key: "email", label: "Email", text: email, href: `mailto:${email}`, external: false });
  if (instagram) {
    rows.push({
      key: "instagram",
      label: "Instagram",
      text: `@${instagram}`,
      href: `https://instagram.com/${instagram}`,
      external: true,
    });
  }
  if (behance) {
    rows.push({ key: "behance", label: "Behance", text: behance, href: `https://behance.net/${behance}`, external: true });
  }

  return (
    <section id="contact" className={`bg-[var(--ui-bg)] text-[var(--ui-fg)] ${SECTION_PAD}`}>
      <div className={GRID}>
        <SectionHeading en="Contact" zh="聯絡" />
        <ul className="flex flex-col lg:col-span-8">
          {rows.map((row) => (
            <li key={row.key} className="border-t border-current/15 last:border-b">
              <a
                href={row.href}
                {...(row.external ? { target: "_blank", rel: "noreferrer" } : {})}
                className="group flex min-h-16 flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5 transition-[padding] duration-300 motion-safe:hover:pl-3"
              >
                <span className={`opacity-70 ${langFontClass("en", "ui")}`} style={META_STYLE}>
                  {row.label}
                </span>
                <span
                  className={`break-all underline decoration-transparent underline-offset-[0.2em] transition-colors duration-200 group-hover:decoration-current group-focus-visible:decoration-current ${langFontClass("en", "display")}`}
                  style={{ fontSize: "clamp(1.25rem, 3vw, 2.5rem)", letterSpacing: "-0.01em" }}
                >
                  {row.text}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
