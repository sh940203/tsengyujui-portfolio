import Image from "next/image";
import { Lang, langFontClass } from "@/components/lang";

/**
 * 關於頁的內容區塊（SPEC.md §4.4：bio 全文、比賽經歷、關於頁圖片、聯絡
 * 資訊）。跟首頁一樣固定用介面黑灰白（SPEC §5.1），不跟著任何系列的
 * theme 走——關於頁不屬於任何系列。
 *
 * 這批的真實資料狀態本來就大量留空（profile 幾乎所有欄位、全部 4 筆
 * awards 的 imageId 都是 null），所以每個區塊都刻意做成「沒資料就不佔
 * 版面」，不是為了測試才這樣寫。
 */

export function AboutHeader({
  nameEn,
  nameZh,
  roleEn,
  roleZh,
  imageR2Key,
}: {
  nameEn: string;
  nameZh: string;
  roleEn: string | null;
  roleZh: string | null;
  imageR2Key: string | null;
}) {
  return (
    <section className="flex flex-col items-center gap-8 bg-[#0A0A0A] px-6 pt-[clamp(6rem,14vw,10rem)] pb-[clamp(3rem,6vw,5rem)] text-center text-[#F2F3F4]">
      {imageR2Key && (
        <div className="relative aspect-[3/4] w-full max-w-xs overflow-hidden bg-white/5">
          <Image src={imageR2Key} alt={nameEn} fill sizes="320px" style={{ objectFit: "cover" }} />
        </div>
      )}
      <div>
        <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", letterSpacing: "-0.01em" }}>
          <Lang en={nameEn} zh={nameZh} role="display" />
        </h1>
        {/* 不用 opacity-70 包 <Lang>——會跟 `.lang-zh`/`.lang-en` 自己的
            0.55 opacity 疊乘，次要語言那個 span 對比掉到 WCAG AA 門檻
            以下（無障礙排查批次抓到，見 HANDOFF.md）。 */}
        {(roleEn || roleZh) && (
          <div className="mt-3" style={{ fontSize: "clamp(0.7rem, 1.5vw, 0.9rem)", letterSpacing: "0.1em" }}>
            <Lang en={roleEn ?? ""} zh={roleZh ?? ""} role="ui" />
          </div>
        )}
      </div>
    </section>
  );
}

export function AboutBio({ bioEn, bioZh }: { bioEn: string | null; bioZh: string | null }) {
  if (!bioEn && !bioZh) return null;
  return (
    <section className="bg-[#0A0A0A] px-6 py-[clamp(3rem,6vw,5rem)] text-[#F2F3F4]">
      <div className="mx-auto max-w-2xl" style={{ fontSize: "clamp(1rem, 2vw, 1.25rem)", lineHeight: 1.7 }}>
        <Lang en={bioEn ?? ""} zh={bioZh ?? ""} role="ui" />
      </div>
    </section>
  );
}

export interface AwardListItem {
  id: string;
  year: string;
  titleEn: string | null;
  titleZh: string | null;
  resultEn: string | null;
  resultZh: string | null;
  certificateR2Key: string | null;
}

/**
 * 官方英文譯名待補的獎項（`titleEn` 為 `null`）不用雙語主從機制去湊——
 * 如果硬塞進 `Lang`，`.lang-en`/`.lang-zh` 兩個 span 會同時顯示同一段
 * 中文字，一大一小疊在一起，等於同一句話重複兩次。缺英文版就直接顯示
 * 中文原文一次，不管目前是哪個語言模式。
 */
function AwardTitle({ titleEn, titleZh }: { titleEn: string | null; titleZh: string | null }) {
  if (titleEn) {
    return <Lang en={titleEn} zh={titleZh ?? ""} role="ui" />;
  }
  return <span className={langFontClass("zh", "ui")}>{titleZh}</span>;
}

function AwardResult({ resultEn, resultZh }: { resultEn: string | null; resultZh: string | null }) {
  if (!resultEn && !resultZh) return null;
  if (resultEn) {
    return <Lang en={resultEn} zh={resultZh ?? ""} role="ui" />;
  }
  return <span className={langFontClass("zh", "ui")}>{resultZh}</span>;
}

export function AwardsList({ items }: { items: AwardListItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="bg-[#0A0A0A] px-6 py-[clamp(3rem,6vw,5rem)] text-[#F2F3F4]">
      <ul className="mx-auto flex max-w-2xl flex-col gap-6">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 border-b border-white/10 pb-6 last:border-none">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span
                className={`opacity-60 ${langFontClass("en", "ui")}`}
                style={{ fontSize: "0.7rem", letterSpacing: "0.1em" }}
              >
                {item.year}
              </span>
              <span style={{ fontSize: "1.05rem" }}>
                <AwardTitle titleEn={item.titleEn} titleZh={item.titleZh} />
              </span>
            </div>
            {/* 不用 opacity-70 包（同一個坑，見 AboutHeader 的註解） */}
            <div style={{ fontSize: "0.85rem" }}>
              <AwardResult resultEn={item.resultEn} resultZh={item.resultZh} />
            </div>
            {item.certificateR2Key && (
              <div className="relative mt-2 aspect-[4/3] w-full max-w-xs overflow-hidden bg-white/5">
                <Image
                  src={item.certificateR2Key}
                  alt={item.titleEn ?? item.titleZh ?? ""}
                  fill
                  sizes="320px"
                  style={{ objectFit: "cover" }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
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
  return (
    <section className="bg-[#0A0A0A] px-6 py-[clamp(3rem,6vw,5rem)] text-center text-[#F2F3F4]">
      <div
        className={`mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-6 ${langFontClass("en", "ui")}`}
        style={{ fontSize: "0.85rem", letterSpacing: "0.05em" }}
      >
        {email && (
          <a href={`mailto:${email}`} className="opacity-70 hover:opacity-100">
            {email}
          </a>
        )}
        {instagram && (
          <a
            href={`https://instagram.com/${instagram}`}
            target="_blank"
            rel="noreferrer"
            className="opacity-70 hover:opacity-100"
          >
            Instagram @{instagram}
          </a>
        )}
        {behance && (
          <a
            href={`https://behance.net/${behance}`}
            target="_blank"
            rel="noreferrer"
            className="opacity-70 hover:opacity-100"
          >
            Behance
          </a>
        )}
      </div>
    </section>
  );
}
