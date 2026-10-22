"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { collections } from "@/lib/db/schema";
import { galleryStyleFor } from "@/lib/collections/gallery-style";
import { sortGalleryAuto } from "@/lib/collections/gallery-order";
import { THEME_META, VISIBILITY_META, type Theme, type Visibility } from "@/components/admin/collection-meta";
import type { PickerCollection, PickerMedia } from "@/components/admin/media-meta";
import { useConfirm, useToast } from "@/components/admin/ui/feedback";
import { ImageField } from "@/components/admin/ui/image-field";
import { IconCheck, IconExternal, IconEye, IconSparkle } from "@/components/admin/ui/icons";
import {
  Badge,
  Button,
  Field,
  PageHeader,
  Section,
  Switch,
  TextArea,
  TextInput,
} from "@/components/admin/ui/primitives";
import { SaveBar } from "@/components/admin/ui/save-bar";
import { buttonClass, cn } from "@/components/admin/ui/styles";
import { saveCollectionEditor } from "../actions";
import { FeaturedStrip, GalleryCurator, type CuratorTile } from "./gallery-curator";

type CollectionRow = typeof collections.$inferSelect;

export interface CuratorItem extends CuratorTile {
  sortOrder: number;
  galleryOrder: number | null;
  aspect: number;
}

interface GalleryState {
  order: string[];
  custom: boolean;
  hidden: string[];
  featured: string[];
}

function toForm(c: CollectionRow) {
  return {
    slug: c.slug,
    titleEn: c.titleEn,
    titleZh: c.titleZh ?? "",
    year: c.year ?? "",
    category: c.category ?? "",
    pieceCount: c.pieceCount != null ? String(c.pieceCount) : "",
    statementEn: c.statementEn ?? "",
    statementZh: c.statementZh ?? "",
    theme: c.theme as Theme,
    visibility: c.visibility as Visibility,
    requiresConsent: c.requiresConsent,
    consentNoteEn: c.consentNoteEn ?? "",
    consentNoteZh: c.consentNoteZh ?? "",
    coverImageId: c.coverImageId,
    ogImageId: c.ogImageId,
    titleImageId: c.titleImageId,
  };
}
type FormState = ReturnType<typeof toForm>;

const FORM_LABELS: Record<keyof FormState, string> = {
  slug: "網址代稱",
  titleEn: "英文標題",
  titleZh: "中文標題",
  year: "年份",
  category: "類型",
  pieceCount: "件數",
  statementEn: "英文敘述",
  statementZh: "中文敘述",
  theme: "主題",
  visibility: "公開狀態",
  requiresConsent: "內容提示",
  consentNoteEn: "英文提示文字",
  consentNoteZh: "中文提示文字",
  coverImageId: "封面圖",
  ogImageId: "分享圖",
  titleImageId: "標題圖",
};

const SECTIONS = [
  { id: "basic", label: "基本資料" },
  { id: "statement", label: "敘述" },
  { id: "appearance", label: "公開與外觀" },
  { id: "gallery", label: "作品長廊" },
  { id: "featured", label: "首頁精選" },
  { id: "images", label: "封面與分享" },
  { id: "consent", label: "內容提示" },
] as const;

const CATEGORY_SUGGESTIONS = ["Womenswear", "Menswear", "Unisex"];

function normalizeGallery(g: GalleryState) {
  return JSON.stringify({
    custom: g.custom,
    order: g.custom ? g.order : null,
    hidden: [...g.hidden].sort(),
    featured: g.featured,
  });
}

/** 依捲動位置標出目前在哪一段（區段導覽列的高亮）。 */
function useScrollSpy(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

function OptionCard({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex w-full flex-col gap-2 rounded-xl border bg-white p-4 text-left transition-[border-color,box-shadow,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/25 focus-visible:ring-offset-2",
        selected ? "border-stone-900 shadow-[0_0_0_1px_rgb(28_25_23)]" : "border-stone-200 hover:border-stone-300 hover:bg-stone-50/60",
      )}
    >
      {selected && (
        <span className="admin-pop absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-stone-900 text-white">
          <IconCheck size={12} strokeWidth={2.6} />
        </span>
      )}
      {children}
    </button>
  );
}

export function CollectionEditor({
  collection,
  items,
  initialGallery,
  pickerMedia,
  pickerCollections,
}: {
  collection: CollectionRow;
  items: CuratorItem[];
  initialGallery: GalleryState;
  pickerMedia: PickerMedia[];
  pickerCollections: PickerCollection[];
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [isSaving, startSaving] = useTransition();

  const [saved, setSaved] = useState(() => ({ form: toForm(collection), gallery: initialGallery }));
  const [form, setForm] = useState<FormState>(saved.form);
  const [gallery, setGallery] = useState<GalleryState>(saved.gallery);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const tiles = useMemo(() => new Map(items.map((i) => [i.id, i as CuratorTile])), [items]);
  const style = galleryStyleFor(form.theme);
  // 沒有自訂順序時，顯示的順序跟著「目前選的主題」的自動規則走（換主題就能立刻看到新順序）
  const displayOrder = useMemo(
    () =>
      gallery.custom
        ? gallery.order
        : sortGalleryAuto(
            items.map((i) => ({ ...i, galleryOrder: null })),
            style,
          ).map((i) => i.id),
    [gallery.custom, gallery.order, items, style],
  );

  const hiddenSet = useMemo(() => new Set(gallery.hidden), [gallery.hidden]);
  const featuredSet = useMemo(() => new Set(gallery.featured), [gallery.featured]);

  const changedFields = (Object.keys(form) as (keyof FormState)[]).filter((k) => form[k] !== saved.form[k]);
  const galleryChanged = normalizeGallery(gallery) !== normalizeGallery(saved.gallery);
  const dirty = changedFields.length > 0 || galleryChanged;
  const changed = (k: keyof FormState) => form[k] !== saved.form[k];

  const active = useScrollSpy(SECTIONS.map((s) => s.id));

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): Partial<Record<keyof FormState, string>> {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.titleEn.trim()) next.titleEn = "英文標題不能空白";
    if (!/^[a-z0-9-]+$/.test(form.slug)) next.slug = "只能用小寫英文、數字和連字號（-）";
    if (form.pieceCount.trim() && !/^\d+$/.test(form.pieceCount.trim())) next.pieceCount = "請填整數";
    if (form.statementEn.length > 4000) next.statementEn = "最多 4000 字";
    if (form.statementZh.length > 4000) next.statementZh = "最多 4000 字";
    return next;
  }

  function handleSave() {
    const nextErrors = validate();
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      toast("error", "有欄位需要修正", Object.values(nextErrors)[0]);
      document.querySelector<HTMLElement>(`[data-field="${firstError}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const snapshot = { form, gallery: { ...gallery, order: displayOrder } };
    startSaving(async () => {
      const result = await saveCollectionEditor({
        collection: {
          id: collection.id,
          slug: form.slug,
          titleEn: form.titleEn.trim(),
          titleZh: form.titleZh.trim() || null,
          year: form.year.trim() || null,
          category: form.category.trim() || null,
          pieceCount: form.pieceCount.trim() ? Number(form.pieceCount) : null,
          statementEn: form.statementEn || null,
          statementZh: form.statementZh || null,
          theme: form.theme,
          visibility: form.visibility,
          requiresConsent: form.requiresConsent,
          consentNoteEn: form.consentNoteEn || null,
          consentNoteZh: form.consentNoteZh || null,
          coverImageId: form.coverImageId,
          ogImageId: form.ogImageId,
          titleImageId: form.titleImageId,
        },
        gallery: { orderedIds: displayOrder, custom: gallery.custom, hiddenIds: gallery.hidden },
        featuredIds: gallery.featured,
      });
      if (result.ok) {
        setSaved(snapshot);
        setGallery(snapshot.gallery);
        toast("success", "已儲存", form.visibility === "draft" ? "這個系列目前是草稿，前台看不到" : "前台已同步更新");
      } else {
        toast("error", "儲存失敗", result.error);
        if (result.error.includes("網址代稱")) setErrors((prev) => ({ ...prev, slug: result.error }));
      }
    });
  }

  async function handleDiscard() {
    const ok = await confirm({
      title: "捨棄所有未儲存的變更？",
      description: "會回到上次儲存的狀態。",
      confirmLabel: "捨棄變更",
      tone: "danger",
    });
    if (!ok) return;
    setForm(saved.form);
    setGallery(saved.gallery);
    setErrors({});
  }

  // ── 長廊操作 ─────────────────────────────────────────────
  function reorder(next: string[]) {
    setGallery((g) => ({ ...g, order: next, custom: true }));
  }
  function toggleHidden(id: string) {
    setGallery((g) => {
      const isHidden = g.hidden.includes(id);
      return {
        ...g,
        hidden: isHidden ? g.hidden.filter((h) => h !== id) : [...g.hidden, id],
        // 隱藏的作品不能留在首頁精選
        featured: isHidden ? g.featured : g.featured.filter((f) => f !== id),
      };
    });
  }
  function toggleFeatured(id: string) {
    setGallery((g) => ({
      ...g,
      featured: g.featured.includes(id) ? g.featured.filter((f) => f !== id) : [...g.featured, id],
    }));
  }
  function resetAutoOrder() {
    setGallery((g) => ({ ...g, custom: false }));
    toast("info", "已改回依類型自動排序", `${THEME_META[form.theme].style}：${style === "venom" ? "海報優先" : "成品優先"}`);
  }

  const title = saved.form.titleZh || saved.form.titleEn;
  const savedVis = VISIBILITY_META[saved.form.visibility];
  const shownCount = displayOrder.filter((id) => !hiddenSet.has(id)).length;
  const hiddenCount = displayOrder.length - shownCount;
  const changeCount = changedFields.length + (galleryChanged ? 1 : 0);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/collections", label: "系列" }}
        title={title}
        meta={
          <Badge tone={savedVis.tone} dot>
            {savedVis.label}
          </Badge>
        }
        description={saved.form.titleZh ? saved.form.titleEn : undefined}
        actions={
          saved.form.visibility !== "draft" ? (
            <a href={`/work/${saved.form.slug}`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md")}>
              <IconExternal size={16} />
              查看前台
            </a>
          ) : undefined
        }
      />

      {/* 區段導覽：手機橫向捲動、桌機一排；捲動時標出目前所在段落 */}
      <nav
        aria-label="編輯區段"
        className="sticky top-14 z-20 -mx-4 mb-6 border-b border-stone-200/80 bg-stone-100/85 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10"
      >
        <ul className="-mb-px flex gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
          {SECTIONS.map((s) => (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                onClick={() => scrollToSection(s.id)}
                aria-current={active === s.id ? "true" : undefined}
                className={cn(
                  "h-9 rounded-lg px-3 text-[13px] transition-colors duration-150",
                  active === s.id ? "bg-white font-medium text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900",
                )}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-6">
        <Section id="basic" title="基本資料" description="標題會出現在首頁、系列頁與分享連結。">
          <div className="grid gap-5 sm:grid-cols-2">
            <div data-field="titleZh">
              <Field label="中文標題" changed={changed("titleZh")} htmlFor="titleZh">
                <TextInput id="titleZh" value={form.titleZh} onChange={(e) => update("titleZh", e.target.value)} placeholder="例如：在最後的淨土上孤獨" />
              </Field>
            </div>
            <div data-field="titleEn">
              <Field label="英文標題" changed={changed("titleEn")} error={errors.titleEn} htmlFor="titleEn">
                <TextInput id="titleEn" value={form.titleEn} invalid={!!errors.titleEn} onChange={(e) => update("titleEn", e.target.value)} />
              </Field>
            </div>
            <div data-field="slug" className="sm:col-span-2">
              <Field
                label="網址代稱"
                changed={changed("slug")}
                error={errors.slug}
                hint={
                  changed("slug") && saved.form.visibility !== "draft"
                    ? "改了之後舊網址會失效，已經分享出去的連結會打不開。"
                    : "系列頁的網址。只能用小寫英文、數字和連字號。"
                }
                htmlFor="slug"
              >
                <div
                  className={cn(
                    "flex h-10 items-center rounded-lg border bg-white text-sm transition-[border-color,box-shadow] focus-within:border-stone-900 focus-within:ring-4 focus-within:ring-stone-900/[0.07]",
                    errors.slug ? "border-red-400" : "border-stone-300 hover:border-stone-400",
                  )}
                >
                  <span className="select-none pl-3 text-stone-400">/work/</span>
                  <input
                    id="slug"
                    value={form.slug}
                    onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    className="h-full min-w-0 flex-1 bg-transparent pr-3 text-stone-900 outline-none"
                    spellCheck={false}
                    autoCapitalize="off"
                  />
                </div>
              </Field>
            </div>
            <div className="grid gap-5 sm:col-span-2 sm:grid-cols-3">
              <Field label="年份" changed={changed("year")} htmlFor="year">
                <TextInput id="year" value={form.year} onChange={(e) => update("year", e.target.value)} placeholder="例如 2025" inputMode="numeric" />
              </Field>
              <Field label="類型" changed={changed("category")} htmlFor="category">
                <TextInput id="category" list="category-suggestions" value={form.category} onChange={(e) => update("category", e.target.value)} placeholder="Womenswear…" />
                <datalist id="category-suggestions">
                  {CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <div data-field="pieceCount">
                <Field label="件數" changed={changed("pieceCount")} error={errors.pieceCount} htmlFor="pieceCount">
                  <TextInput id="pieceCount" value={form.pieceCount} invalid={!!errors.pieceCount} onChange={(e) => update("pieceCount", e.target.value)} placeholder="例如 6" inputMode="numeric" />
                </Field>
              </div>
            </div>
          </div>
          {(!form.year || !form.category) && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              年份與類型都填了，系列頁左欄才會顯示「年份 — 類型 — 件數」這一行。
            </p>
          )}
        </Section>

        <Section id="statement" title="概念敘述" description="系列頁左欄的完整敘述。換行會原樣保留，可以用換行控制節奏。">
          <div className="grid gap-5 lg:grid-cols-2">
            <div data-field="statementZh">
              <Field label="中文" changed={changed("statementZh")} error={errors.statementZh} counter={{ value: form.statementZh.length, max: 4000 }} htmlFor="statementZh">
                <TextArea id="statementZh" minRows={6} value={form.statementZh} onChange={(e) => update("statementZh", e.target.value)} />
              </Field>
            </div>
            <div data-field="statementEn">
              <Field label="英文" changed={changed("statementEn")} error={errors.statementEn} counter={{ value: form.statementEn.length, max: 4000 }} htmlFor="statementEn">
                <TextArea id="statementEn" minRows={6} value={form.statementEn} onChange={(e) => update("statementEn", e.target.value)} />
              </Field>
            </div>
          </div>
        </Section>

        <Section id="appearance" title="公開狀態與外觀">
          <Field label="公開狀態" changed={changed("visibility")}>
            <div role="radiogroup" aria-label="公開狀態" className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(VISIBILITY_META) as Visibility[]).map((v) => {
                const meta = VISIBILITY_META[v];
                return (
                  <OptionCard key={v} selected={form.visibility === v} onSelect={() => update("visibility", v)}>
                    <Badge tone={meta.tone} dot className="self-start">
                      {meta.label}
                    </Badge>
                    <span className="text-xs leading-relaxed text-stone-500">{meta.description}</span>
                  </OptionCard>
                );
              })}
            </div>
          </Field>
          {saved.form.visibility === "public" && form.visibility !== "public" && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              儲存後這個系列會從首頁消失{form.visibility === "draft" ? "，系列頁也會無法開啟" : ""}。
            </p>
          )}

          <div className="mt-6">
            <Field label="主題（底色與長廊節奏）" changed={changed("theme")}>
              <div role="radiogroup" aria-label="主題" className="grid gap-3 sm:grid-cols-3">
                {(Object.keys(THEME_META) as Theme[]).map((t) => {
                  const meta = THEME_META[t];
                  return (
                    <OptionCard key={t} selected={form.theme === t} onSelect={() => update("theme", t)}>
                      <span
                        className="flex h-16 items-end rounded-lg px-3 pb-2 ring-1 ring-inset ring-black/5"
                        style={{ background: meta.swatch[0], color: meta.swatch[1] }}
                      >
                        <span className="text-lg font-semibold tracking-tight">Aa 作品</span>
                      </span>
                      <span className="text-sm font-medium text-stone-900">
                        {meta.label}
                        <span className="ml-1 font-normal text-stone-500">· {meta.style}</span>
                      </span>
                      <span className="text-xs leading-relaxed text-stone-500">{meta.description}</span>
                    </OptionCard>
                  );
                })}
              </div>
            </Field>
          </div>
        </Section>

        <Section
          id="gallery"
          title="作品長廊"
          description="系列頁右欄依序展示的作品。拖曳縮圖調整順序（手機請長按後拖曳）；眼睛＝在前台隱藏；星星＝放進首頁輪播。"
          actions={
            <>
              <Badge tone={gallery.custom ? "dark" : "neutral"}>{gallery.custom ? "自訂順序" : "依類型自動排序"}</Badge>
              {gallery.custom && (
                <Button size="sm" variant="secondary" icon={<IconSparkle size={15} />} onClick={resetAutoOrder}>
                  改回自動排序
                </Button>
              )}
              {hiddenCount > 0 && (
                <Button size="sm" variant="ghost" icon={<IconEye size={15} />} onClick={() => setGallery((g) => ({ ...g, hidden: [] }))}>
                  全部顯示
                </Button>
              )}
            </>
          }
        >
          <p className="mb-4 text-[13px] text-stone-600">
            前台顯示 <strong className="font-semibold text-stone-900">{shownCount}</strong> 件
            {hiddenCount > 0 && (
              <>
                ，隱藏 <strong className="font-semibold text-stone-900">{hiddenCount}</strong> 件
              </>
            )}
            {items.length === 0 && "——這個系列還沒有圖片，請先到「圖庫」上傳並指派到這個系列。"}
          </p>
          {items.length > 0 && (
            <GalleryCurator
              tiles={tiles}
              order={displayOrder}
              hidden={hiddenSet}
              featured={featuredSet}
              onReorder={reorder}
              onToggleHidden={toggleHidden}
              onToggleFeatured={toggleFeatured}
            />
          )}
        </Section>

        <Section
          id="featured"
          title="首頁輪播精選"
          description="首頁左右兩欄同時輪播，同一時間的兩張一定來自同一個系列。在上方長廊點星星加入。"
        >
          <FeaturedStrip
            tiles={tiles}
            featured={gallery.featured}
            onReorder={(next) => setGallery((g) => ({ ...g, featured: next }))}
            onRemove={(id) => setGallery((g) => ({ ...g, featured: g.featured.filter((f) => f !== id) }))}
          />
        </Section>

        <Section id="images" title="封面與分享圖">
          <div className="grid gap-5 lg:grid-cols-3">
            <ImageField
              label="封面圖"
              hint="首頁系列區塊與後台卡片使用。沒設定就用長廊第一張。"
              value={form.coverImageId}
              onChange={(v) => update("coverImageId", v)}
              media={pickerMedia}
              collections={pickerCollections}
              defaultCollectionId={collection.id}
              changed={changed("coverImageId")}
            />
            <ImageField
              label="分享圖"
              hint="分享到 Facebook、LINE 時顯示的圖。必須自己指定，不會自動抓第一張（避免含裸露的作品被社群平台降低觸及）。"
              value={form.ogImageId}
              onChange={(v) => update("ogImageId", v)}
              media={pickerMedia}
              collections={pickerCollections}
              defaultCollectionId={collection.id}
              changed={changed("ogImageId")}
            />
            <ImageField
              label="標題圖"
              hint="手寫字或自製標題的去背圖。前台目前還沒有使用這張圖（之後可以拿來取代文字標題）。"
              value={form.titleImageId}
              onChange={(v) => update("titleImageId", v)}
              media={pickerMedia}
              collections={pickerCollections}
              defaultCollectionId={collection.id}
              changed={changed("titleImageId")}
            />
          </div>
        </Section>

        <Section id="consent" title="內容提示" description="含裸露、菸酒等內容時，進入系列頁前先顯示一層提示，訪客按「進入」才看得到作品。">
          <Switch
            checked={form.requiresConsent}
            onChange={(v) => update("requiresConsent", v)}
            label={<>進入前顯示內容提示 {changed("requiresConsent") && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />}</>}
            description="提示層是禮貌提醒，不是存取限制——搜尋引擎與直接開圖片網址都不受影響。"
          />
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
              form.requiresConsent ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
            aria-hidden={!form.requiresConsent}
          >
            <div className="overflow-hidden">
              <div className="grid gap-5 pt-5 sm:grid-cols-2">
                <Field label="中文提示文字" changed={changed("consentNoteZh")} htmlFor="consentNoteZh">
                  <TextArea id="consentNoteZh" minRows={3} value={form.consentNoteZh} onChange={(e) => update("consentNoteZh", e.target.value)} tabIndex={form.requiresConsent ? 0 : -1} />
                </Field>
                <Field label="英文提示文字" changed={changed("consentNoteEn")} htmlFor="consentNoteEn">
                  <TextArea id="consentNoteEn" minRows={3} value={form.consentNoteEn} onChange={(e) => update("consentNoteEn", e.target.value)} tabIndex={form.requiresConsent ? 0 : -1} />
                </Field>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <SaveBar
        dirty={dirty}
        saving={isSaving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        changeCount={changeCount}
      />
      {/* 螢幕閱讀器：告訴使用者改了哪些 */}
      <p className="sr-only" aria-live="polite">
        {dirty ? `尚未儲存：${[...changedFields.map((k) => FORM_LABELS[k]), ...(galleryChanged ? ["作品長廊"] : [])].join("、")}` : ""}
      </p>
    </>
  );
}

