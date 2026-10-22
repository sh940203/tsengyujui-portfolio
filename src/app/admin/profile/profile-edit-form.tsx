"use client";

import { useState, useTransition } from "react";
import type { profile } from "@/lib/db/schema";
import type { PickerCollection, PickerMedia } from "@/components/admin/media-meta";
import { useConfirm, useToast } from "@/components/admin/ui/feedback";
import { ImageField } from "@/components/admin/ui/image-field";
import { Field, PageHeader, Section, TextArea, TextInput } from "@/components/admin/ui/primitives";
import { SaveBar } from "@/components/admin/ui/save-bar";
import { updateProfile } from "./actions";

type ProfileRow = typeof profile.$inferSelect;

/**
 * 個人資料（2026-10-22 改版）：原本是一長串英文欄位名（`bioEn`、`seoTitle`…）加檔名下拉選單。
 * 現在分段、欄位用中文說明「這會出現在網站哪裡」，圖片用縮圖挑，搜尋結果有即時預覽。
 */

function toForm(p: ProfileRow) {
  return {
    nameZh: p.nameZh ?? "",
    nameEn: p.nameEn ?? "",
    roleZh: p.roleZh ?? "",
    roleEn: p.roleEn ?? "",
    locationZh: p.locationZh ?? "",
    locationEn: p.locationEn ?? "",
    bioZh: p.bioZh ?? "",
    bioEn: p.bioEn ?? "",
    email: p.email ?? "",
    instagram: p.instagram ?? "",
    behance: p.behance ?? "",
    heroImageId: p.heroImageId,
    aboutImageId: p.aboutImageId,
    defaultOgImageId: p.defaultOgImageId,
    seoTitle: p.seoTitle ?? "",
    seoDescription: p.seoDescription ?? "",
  };
}
type FormState = ReturnType<typeof toForm>;

/** 貼上整段 IG 網址或帶 @ 的帳號，都整理成純帳號。 */
function normalizeInstagram(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "");
}

export function ProfileEditForm({
  profile: profileRow,
  pickerMedia,
  pickerCollections,
}: {
  profile: ProfileRow;
  pickerMedia: PickerMedia[];
  pickerCollections: PickerCollection[];
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [saved, setSaved] = useState(() => toForm(profileRow));
  const [form, setForm] = useState<FormState>(saved);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const changedKeys = (Object.keys(form) as (keyof FormState)[]).filter((k) => form[k] !== saved[k]);
  const dirty = changedKeys.length > 0;
  const changed = (k: keyof FormState) => form[k] !== saved[k];
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function save() {
    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("信箱格式不正確");
      toast("error", "信箱格式不正確");
      document.getElementById("email")?.focus();
      return;
    }
    setEmailError(null);
    const next = { ...form, email, instagram: normalizeInstagram(form.instagram) };
    const nullable = (v: string) => (v.trim() ? v : null);
    startSaving(async () => {
      const result = await updateProfile({
        nameEn: nullable(next.nameEn),
        nameZh: nullable(next.nameZh),
        roleEn: nullable(next.roleEn),
        roleZh: nullable(next.roleZh),
        locationEn: nullable(next.locationEn),
        locationZh: nullable(next.locationZh),
        bioEn: nullable(next.bioEn),
        bioZh: nullable(next.bioZh),
        email: nullable(next.email),
        instagram: nullable(next.instagram),
        behance: nullable(next.behance),
        heroImageId: next.heroImageId,
        aboutImageId: next.aboutImageId,
        seoTitle: nullable(next.seoTitle),
        seoDescription: nullable(next.seoDescription),
        defaultOgImageId: next.defaultOgImageId,
      });
      if (result.ok) {
        setSaved(next);
        setForm(next);
        toast("success", "已儲存", "首頁與關於頁已同步更新");
      } else {
        toast("error", "儲存失敗", result.error);
      }
    });
  }

  async function discard() {
    if (
      await confirm({ title: "捨棄所有未儲存的變更？", description: "會回到上次儲存的狀態。", confirmLabel: "捨棄變更", tone: "danger" })
    ) {
      setForm(saved);
      setEmailError(null);
    }
  }

  const seoTitle = form.seoTitle || `${form.nameEn || "Tseng Yu Jui"} — ${form.roleEn || "Fashion Designer"}`;
  const seoDescription = form.seoDescription || form.bioEn || "（沒有填描述時，會用英文簡介的開頭，再沒有就用網站預設的一句介紹）";

  return (
    <>
      <PageHeader title="個人資料" description="姓名、簡介、聯絡方式與分享設定。這些內容會出現在首頁、關於頁與頁尾。" />

      <div className="flex flex-col gap-6">
        <Section id="identity" title="姓名與職稱" description="首頁大字姓名下方的那一行，以及搜尋結果裡的身分說明。">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="中文姓名" changed={changed("nameZh")} htmlFor="nameZh">
              <TextInput id="nameZh" value={form.nameZh} onChange={(e) => update("nameZh", e.target.value)} />
            </Field>
            <Field label="英文姓名" changed={changed("nameEn")} htmlFor="nameEn">
              <TextInput id="nameEn" value={form.nameEn} onChange={(e) => update("nameEn", e.target.value)} />
            </Field>
            <Field label="中文職稱" changed={changed("roleZh")} htmlFor="roleZh">
              <TextInput id="roleZh" value={form.roleZh} onChange={(e) => update("roleZh", e.target.value)} placeholder="服裝設計師" />
            </Field>
            <Field label="英文職稱" changed={changed("roleEn")} htmlFor="roleEn">
              <TextInput id="roleEn" value={form.roleEn} onChange={(e) => update("roleEn", e.target.value)} placeholder="Fashion Designer" />
            </Field>
            <Field label="所在地（中文）" changed={changed("locationZh")} htmlFor="locationZh" hint="選填，例如「台中」。填了會接在職稱後面。">
              <TextInput id="locationZh" value={form.locationZh} onChange={(e) => update("locationZh", e.target.value)} />
            </Field>
            <Field label="所在地（英文）" changed={changed("locationEn")} htmlFor="locationEn">
              <TextInput id="locationEn" value={form.locationEn} onChange={(e) => update("locationEn", e.target.value)} placeholder="Taichung" />
            </Field>
          </div>
        </Section>

        <Section
          id="bio"
          title="簡介"
          description="填了之後，首頁會出現一段簡介區塊、導覽列會出現「Bio」，關於頁也會顯示完整簡介。換行會原樣保留。"
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <Field label="中文" changed={changed("bioZh")} counter={{ value: form.bioZh.length, max: 4000 }} htmlFor="bioZh">
              <TextArea id="bioZh" minRows={6} value={form.bioZh} onChange={(e) => update("bioZh", e.target.value)} />
            </Field>
            <Field label="英文" changed={changed("bioEn")} counter={{ value: form.bioEn.length, max: 4000 }} htmlFor="bioEn">
              <TextArea id="bioEn" minRows={6} value={form.bioEn} onChange={(e) => update("bioEn", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section id="contact" title="聯絡方式" description="出現在關於頁的聯絡區塊，以及首頁、關於頁的頁尾（Behance 只在關於頁）。沒填的項目不會顯示。">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="信箱" changed={changed("email")} error={emailError} htmlFor="email">
              <TextInput
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                invalid={!!emailError}
                onChange={(e) => {
                  update("email", e.target.value);
                  setEmailError(null);
                }}
                placeholder="name@example.com"
              />
            </Field>
            <Field label="Instagram" changed={changed("instagram")} htmlFor="instagram" hint="填帳號就好，貼整個網址也會自動整理。">
              <TextInput
                id="instagram"
                leading="@"
                value={form.instagram}
                onChange={(e) => update("instagram", e.target.value.replace(/^@/, ""))}
                onBlur={(e) => update("instagram", normalizeInstagram(e.target.value))}
                autoCapitalize="off"
                spellCheck={false}
              />
            </Field>
            <Field label="Behance" changed={changed("behance")} htmlFor="behance" hint="帳號名稱。">
              <TextInput id="behance" value={form.behance} onChange={(e) => update("behance", e.target.value)} autoCapitalize="off" spellCheck={false} />
            </Field>
          </div>
        </Section>

        <Section id="images" title="圖片">
          <div className="grid gap-5 lg:grid-cols-3">
            <ImageField
              label="簡介區塊背景"
              hint="首頁簡介區塊後面的滿版照片（有填簡介才會出現）。"
              value={form.aboutImageId}
              onChange={(v) => update("aboutImageId", v)}
              media={pickerMedia}
              collections={pickerCollections}
              changed={changed("aboutImageId")}
            />
            <ImageField
              label="首頁備援圖"
              hint="首頁輪播完全沒有系列圖可用時才會出現；平常看不到。"
              value={form.heroImageId}
              onChange={(v) => update("heroImageId", v)}
              media={pickerMedia}
              collections={pickerCollections}
              changed={changed("heroImageId")}
            />
            <ImageField
              label="預設分享圖"
              hint="分享首頁、關於頁到社群時顯示的圖。"
              value={form.defaultOgImageId}
              onChange={(v) => update("defaultOgImageId", v)}
              media={pickerMedia}
              collections={pickerCollections}
              changed={changed("defaultOgImageId")}
            />
          </div>
        </Section>

        <Section id="seo" title="搜尋與分享" description="Google 搜尋結果與社群分享時顯示的標題、描述。不填會自動用姓名＋職稱、英文簡介。">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              <Field label="標題" changed={changed("seoTitle")} counter={{ value: form.seoTitle.length, max: 60 }} htmlFor="seoTitle" hint="建議 60 字元以內，太長會被截斷。">
                <TextInput id="seoTitle" value={form.seoTitle} onChange={(e) => update("seoTitle", e.target.value)} placeholder={`${form.nameEn || "Tseng Yu Jui"} — ${form.roleEn || "Fashion Designer"}`} />
              </Field>
              <Field label="描述" changed={changed("seoDescription")} counter={{ value: form.seoDescription.length, max: 160 }} htmlFor="seoDescription" hint="建議 160 字元以內。">
                <TextArea id="seoDescription" minRows={3} value={form.seoDescription} onChange={(e) => update("seoDescription", e.target.value)} />
              </Field>
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-stone-800">搜尋結果預覽</p>
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs text-stone-500">tsengyujui-portfolio.vercel.app</p>
                <p className="mt-1 line-clamp-1 text-lg leading-snug text-[#1a0dab]">{seoTitle}</p>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-stone-600">{seoDescription}</p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <SaveBar dirty={dirty} saving={isSaving} onSave={save} onDiscard={discard} changeCount={changedKeys.length} />
    </>
  );
}
