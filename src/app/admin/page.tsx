import { asc, eq } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { awards, collections, media, profile } from "@/lib/db/schema";
import { Badge, PageHeader, Section } from "@/components/admin/ui/primitives";
import { buttonClass } from "@/components/admin/ui/styles";
import {
  IconAlert,
  IconCheck,
  IconChevronRight,
  IconImage,
  IconLayers,
  IconTrophy,
  IconUpload,
  IconUser,
} from "@/components/admin/ui/icons";
import { VISIBILITY_META } from "@/components/admin/collection-meta";

/**
 * 後台總覽（SPEC §7.1 的 `/admin` 儀表板，原本從來沒有實作，登入後直接被丟到系列列表）。
 * 一眼看到：網站目前狀態、還缺哪些資料（每一項都能直接點過去補）、三個系列的入口。
 * 「待補資料」全部由資料庫現況即時算出來，不是寫死的清單。
 */
export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const [profileRow] = await db
    .select({
      bioEn: profile.bioEn,
      bioZh: profile.bioZh,
      email: profile.email,
      instagram: profile.instagram,
    })
    .from(profile)
    .where(eq(profile.id, "singleton"))
    .limit(1);

  const [collectionRows, mediaRows, awardRows] = await Promise.all([
    db
      .select({
        id: collections.id,
        slug: collections.slug,
        titleEn: collections.titleEn,
        titleZh: collections.titleZh,
        year: collections.year,
        category: collections.category,
        visibility: collections.visibility,
        coverImageId: collections.coverImageId,
      })
      .from(collections)
      .orderBy(asc(collections.sortOrder)),
    db
      .select({
        id: media.id,
        r2Key: media.r2Key,
        collectionId: media.collectionId,
        altEn: media.altEn,
        altZh: media.altZh,
        galleryHidden: media.galleryHidden,
        sortOrder: media.sortOrder,
      })
      .from(media)
      .orderBy(asc(media.sortOrder)),
    db.select({ id: awards.id, titleEn: awards.titleEn }).from(awards),
  ]);

  const missingAlt = mediaRows.filter((m) => m.collectionId && !m.altEn && !m.altZh).length;
  const publicCount = collectionRows.filter((c) => c.visibility === "public").length;

  const todos: { label: string; detail?: string; href: string }[] = [];
  if (!profileRow?.bioEn && !profileRow?.bioZh) {
    todos.push({ label: "填寫個人簡介", detail: "填了之後首頁會出現簡介區塊、導覽列出現 Bio", href: "/admin/profile#bio" });
  }
  if (!profileRow?.email) todos.push({ label: "填寫聯絡信箱", detail: "關於頁與頁尾的聯絡方式", href: "/admin/profile#contact" });
  if (!profileRow?.instagram) todos.push({ label: "填寫 Instagram 帳號", href: "/admin/profile#contact" });
  for (const c of collectionRows) {
    if (!c.year || !c.category) {
      todos.push({
        label: `補上「${c.titleZh ?? c.titleEn}」的年份與類型`,
        detail: "系列頁左欄的資訊列需要這兩個欄位才會顯示",
        href: `/admin/collections/${c.id}#basic`,
      });
    }
  }
  if (missingAlt > 0) {
    todos.push({
      label: `${missingAlt} 張作品缺替代文字`,
      detail: "給螢幕閱讀器與搜尋引擎看的圖片描述，目前前台用「系列名＋類型」代替",
      href: "/admin/media?filter=missing-alt",
    });
  }
  const awardsMissingEn = awardRows.filter((a) => !a.titleEn).length;
  if (awardsMissingEn > 0) {
    todos.push({
      label: `${awardsMissingEn} 個獎項沒有英文名稱`,
      detail: "沒有官方英譯可以留空，前台只顯示中文",
      href: "/admin/awards",
    });
  }

  const coverFor = (c: (typeof collectionRows)[number]) => {
    const own = mediaRows.filter((m) => m.collectionId === c.id);
    const cover = c.coverImageId ? own.find((m) => m.id === c.coverImageId) : undefined;
    return (cover ?? own.find((m) => !m.galleryHidden) ?? own[0])?.r2Key ?? null;
  };

  const stats = [
    { label: "公開系列", value: `${publicCount}`, sub: `共 ${collectionRows.length} 個`, icon: IconLayers, href: "/admin/collections" },
    { label: "圖庫", value: `${mediaRows.length}`, sub: `${mediaRows.filter((m) => !m.collectionId).length} 張未指派系列`, icon: IconImage, href: "/admin/media" },
    { label: "缺替代文字", value: `${missingAlt}`, sub: missingAlt ? "建議補上" : "全部都有", icon: IconAlert, href: "/admin/media?filter=missing-alt" },
    { label: "獎項", value: `${awardRows.length}`, sub: "顯示在首頁與關於頁", icon: IconTrophy, href: "/admin/awards" },
  ];

  return (
    <>
      <PageHeader
        title="總覽"
        description="網站目前的狀態與還沒補齊的資料。修改後按儲存，前台會在幾秒內同步更新。"
        actions={
          <>
            <Link href="/admin/media?upload=1" className={buttonClass("secondary", "md")}>
              <IconUpload size={16} />
              上傳圖片
            </Link>
            <a href="/" target="_blank" rel="noreferrer" className={buttonClass("primary", "md")}>
              查看網站
            </a>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="group rounded-2xl border border-stone-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md sm:p-5"
            >
              <div className="flex items-center justify-between text-stone-400">
                <span className="text-[13px] text-stone-500">{s.label}</span>
                <Icon size={18} className="transition-colors group-hover:text-stone-700" />
              </div>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-stone-900">{s.value}</p>
              <p className="mt-1 text-xs text-stone-500">{s.sub}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Section
          className="lg:col-span-3"
          title="待補資料"
          description={todos.length ? "點任一項直接前往補上。" : undefined}
          bodyClassName="p-2 sm:p-2"
        >
          {todos.length === 0 ? (
            <div className="flex items-center gap-3 px-3 py-6 text-sm text-stone-600">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                <IconCheck size={16} />
              </span>
              資料都齊全了
            </div>
          ) : (
            <ul className="flex flex-col">
              {todos.map((t) => (
                <li key={t.label}>
                  <Link
                    href={t.href}
                    className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-stone-50"
                  >
                    <span className="mt-0.5 h-2 w-2 shrink-0 self-start rounded-full bg-amber-400 sm:mt-1.5" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-stone-800">{t.label}</span>
                      {t.detail && <span className="mt-0.5 block text-xs text-stone-500">{t.detail}</span>}
                    </span>
                    <IconChevronRight size={16} className="shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-stone-600" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section className="lg:col-span-2" title="快速前往" bodyClassName="p-2 sm:p-2">
          <ul className="flex flex-col">
            {[
              { href: "/admin/media?upload=1", label: "上傳新作品", icon: IconUpload },
              { href: "/admin/profile", label: "編輯個人資料與簡介", icon: IconUser },
              { href: "/admin/awards", label: "管理比賽經歷", icon: IconTrophy },
            ].map((q) => {
              const Icon = q.icon;
              return (
                <li key={q.href}>
                  <Link href={q.href} className="group flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-stone-700 transition-colors hover:bg-stone-50">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-stone-100 text-stone-500 transition-colors group-hover:bg-stone-900 group-hover:text-white">
                      <Icon size={16} />
                    </span>
                    {q.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      </div>

      <h2 className="mb-3 mt-10 text-[15px] font-semibold text-stone-900">系列</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collectionRows.map((c) => {
          const cover = coverFor(c);
          const vis = VISIBILITY_META[c.visibility];
          return (
            <Link
              key={c.id}
              href={`/admin/collections/${c.id}`}
              className="group overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-lg"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-stone-100">
                {cover && (
                  <Image
                    src={cover}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 92vw, 360px"
                    style={{ objectFit: "cover" }}
                    className="transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                )}
              </div>
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">{c.titleZh ?? c.titleEn}</p>
                  <p className="truncate text-xs text-stone-500">{c.titleEn}</p>
                </div>
                <Badge tone={vis.tone} dot>
                  {vis.label}
                </Badge>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
