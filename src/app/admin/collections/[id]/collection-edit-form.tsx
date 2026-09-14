"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { collections } from "@/lib/db/schema";
import { updateCollection } from "../actions";

type CollectionRow = typeof collections.$inferSelect;
interface MediaOption {
  id: string;
  filename: string | null;
  kind: string;
}

const THEME_OPTIONS = ["dark", "light", "void"] as const;
const VISIBILITY_OPTIONS = ["public", "unlisted", "draft"] as const;

function ImagePicker({
  label,
  value,
  onChange,
  mediaOptions,
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  mediaOptions: MediaOption[];
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
      <select
        className="rounded border px-2 py-1"
        value={value ?? "none"}
        onChange={(e) => onChange(e.target.value === "none" ? null : e.target.value)}
      >
        <option value="none">（無）</option>
        {mediaOptions.map((m) => (
          <option key={m.id} value={m.id}>
            {(m.filename ?? m.id) + " · " + m.kind}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CollectionEditForm({
  collection,
  mediaOptions,
}: {
  collection: CollectionRow;
  mediaOptions: MediaOption[];
}) {
  const [form, setForm] = useState({
    slug: collection.slug,
    titleEn: collection.titleEn,
    titleZh: collection.titleZh ?? "",
    year: collection.year ?? "",
    category: collection.category ?? "",
    pieceCount: collection.pieceCount != null ? String(collection.pieceCount) : "",
    statementEn: collection.statementEn ?? "",
    statementZh: collection.statementZh ?? "",
    theme: collection.theme,
    visibility: collection.visibility,
    requiresConsent: collection.requiresConsent,
    consentNoteEn: collection.consentNoteEn ?? "",
    consentNoteZh: collection.consentNoteZh ?? "",
    coverImageId: collection.coverImageId,
    ogImageId: collection.ogImageId,
    titleImageId: collection.titleImageId,
  });
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const pieceCount = form.pieceCount.trim() === "" ? null : Number(form.pieceCount);
    if (pieceCount !== null && !Number.isInteger(pieceCount)) {
      setMessage({ type: "error", text: "件數必須是整數" });
      return;
    }

    startTransition(async () => {
      const result = await updateCollection({
        id: collection.id,
        slug: form.slug,
        titleEn: form.titleEn,
        titleZh: form.titleZh || null,
        year: form.year || null,
        category: form.category || null,
        pieceCount,
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
      });

      if (result.ok) {
        setMessage({ type: "ok", text: "已儲存" });
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-medium">編輯系列：{collection.titleEn}</h1>
      <Link
        href={`/admin/collections/${collection.id}/blocks`}
        className="mt-1 inline-block text-sm underline"
      >
        編輯區塊 →
      </Link>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium">slug</span>
          <input
            className="rounded border px-2 py-1"
            value={form.slug}
            onChange={(e) => update("slug", e.target.value)}
            required
          />
        </label>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">titleEn</span>
            <input
              className="rounded border px-2 py-1"
              value={form.titleEn}
              onChange={(e) => update("titleEn", e.target.value)}
              required
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">titleZh</span>
            <input
              className="rounded border px-2 py-1"
              value={form.titleZh}
              onChange={(e) => update("titleZh", e.target.value)}
            />
          </label>
        </div>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">年份</span>
            <input
              className="rounded border px-2 py-1"
              value={form.year}
              onChange={(e) => update("year", e.target.value)}
              placeholder="尚未提供"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">類型</span>
            <input
              className="rounded border px-2 py-1"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              placeholder="Womenswear / Menswear / Unisex，尚未提供"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">件數</span>
            <input
              className="rounded border px-2 py-1"
              value={form.pieceCount}
              onChange={(e) => update("pieceCount", e.target.value)}
              placeholder="尚未提供"
              inputMode="numeric"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-medium">statementEn</span>
          <textarea
            className="rounded border px-2 py-1"
            rows={4}
            value={form.statementEn}
            onChange={(e) => update("statementEn", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">statementZh</span>
          <textarea
            className="rounded border px-2 py-1"
            rows={4}
            value={form.statementZh}
            onChange={(e) => update("statementZh", e.target.value)}
          />
          <span className="text-xs text-neutral-500">
            換行會原樣保留（前台以 white-space: pre-line 渲染），不會自動合併段落。
          </span>
        </label>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">theme</span>
            <select
              className="rounded border px-2 py-1"
              value={form.theme}
              onChange={(e) => update("theme", e.target.value as CollectionRow["theme"])}
            >
              {THEME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">visibility</span>
            <select
              className="rounded border px-2 py-1"
              value={form.visibility}
              onChange={(e) =>
                update("visibility", e.target.value as CollectionRow["visibility"])
              }
            >
              {VISIBILITY_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.requiresConsent}
            onChange={(e) => update("requiresConsent", e.target.checked)}
          />
          <span className="font-medium">requiresConsent（進入前顯示內容提示）</span>
        </label>

        {form.requiresConsent && (
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1">
              <span className="font-medium">consentNoteEn</span>
              <textarea
                className="rounded border px-2 py-1"
                rows={2}
                value={form.consentNoteEn}
                onChange={(e) => update("consentNoteEn", e.target.value)}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="font-medium">consentNoteZh</span>
              <textarea
                className="rounded border px-2 py-1"
                rows={2}
                value={form.consentNoteZh}
                onChange={(e) => update("consentNoteZh", e.target.value)}
              />
            </label>
          </div>
        )}

        <hr />

        <ImagePicker
          label="封面圖 coverImageId"
          value={form.coverImageId}
          onChange={(id) => update("coverImageId", id)}
          mediaOptions={mediaOptions}
        />
        <ImagePicker
          label="OG 圖 ogImageId"
          value={form.ogImageId}
          onChange={(id) => update("ogImageId", id)}
          mediaOptions={mediaOptions}
          hint="必須獨立指定，不會自動帶入封面圖或第一張圖片（SPEC.md §7.5）"
        />
        <ImagePicker
          label="標題圖 titleImageId"
          value={form.titleImageId}
          onChange={(id) => update("titleImageId", id)}
          mediaOptions={mediaOptions}
          hint="有指定時前台以圖片取代文字標題"
        />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded border px-4 py-2 disabled:opacity-50"
          >
            {isPending ? "儲存中…" : "儲存"}
          </button>
          {message && (
            <span className={message.type === "ok" ? "text-green-600" : "text-red-600"}>
              {message.text}
            </span>
          )}
        </div>
      </form>
    </main>
  );
}
