"use client";

import { useState, useTransition } from "react";
import type { profile } from "@/lib/db/schema";
import { updateProfile } from "./actions";

type ProfileRow = typeof profile.$inferSelect;
interface MediaOption {
  id: string;
  filename: string | null;
  kind: string;
}

function ImagePicker({
  label,
  value,
  onChange,
  mediaOptions,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  mediaOptions: MediaOption[];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
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

export function ProfileEditForm({
  profile,
  mediaOptions,
}: {
  profile: ProfileRow;
  mediaOptions: MediaOption[];
}) {
  const [form, setForm] = useState({
    nameEn: profile.nameEn ?? "",
    nameZh: profile.nameZh ?? "",
    roleEn: profile.roleEn ?? "",
    roleZh: profile.roleZh ?? "",
    locationEn: profile.locationEn ?? "",
    locationZh: profile.locationZh ?? "",
    bioEn: profile.bioEn ?? "",
    bioZh: profile.bioZh ?? "",
    email: profile.email ?? "",
    instagram: profile.instagram ?? "",
    behance: profile.behance ?? "",
    heroImageId: profile.heroImageId,
    aboutImageId: profile.aboutImageId,
    seoTitle: profile.seoTitle ?? "",
    seoDescription: profile.seoDescription ?? "",
    defaultOgImageId: profile.defaultOgImageId,
  });
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await updateProfile({
        nameEn: form.nameEn || null,
        nameZh: form.nameZh || null,
        roleEn: form.roleEn || null,
        roleZh: form.roleZh || null,
        locationEn: form.locationEn || null,
        locationZh: form.locationZh || null,
        bioEn: form.bioEn || null,
        bioZh: form.bioZh || null,
        email: form.email || null,
        instagram: form.instagram || null,
        behance: form.behance || null,
        heroImageId: form.heroImageId,
        aboutImageId: form.aboutImageId,
        seoTitle: form.seoTitle || null,
        seoDescription: form.seoDescription || null,
        defaultOgImageId: form.defaultOgImageId,
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
      <h1 className="text-xl font-medium">個人資料</h1>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 text-sm">
        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">姓名（中）</span>
            <input
              className="rounded border px-2 py-1"
              value={form.nameZh}
              onChange={(e) => update("nameZh", e.target.value)}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">姓名（英）</span>
            <input
              className="rounded border px-2 py-1"
              value={form.nameEn}
              onChange={(e) => update("nameEn", e.target.value)}
            />
          </label>
        </div>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">職稱（中）</span>
            <input
              className="rounded border px-2 py-1"
              value={form.roleZh}
              onChange={(e) => update("roleZh", e.target.value)}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">職稱（英）</span>
            <input
              className="rounded border px-2 py-1"
              value={form.roleEn}
              onChange={(e) => update("roleEn", e.target.value)}
            />
          </label>
        </div>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">所在地（中）</span>
            <input
              className="rounded border px-2 py-1"
              value={form.locationZh}
              onChange={(e) => update("locationZh", e.target.value)}
              placeholder="尚未提供"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">所在地（英）</span>
            <input
              className="rounded border px-2 py-1"
              value={form.locationEn}
              onChange={(e) => update("locationEn", e.target.value)}
              placeholder="尚未提供"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-medium">bio（中）</span>
          <textarea
            className="rounded border px-2 py-1"
            rows={4}
            value={form.bioZh}
            onChange={(e) => update("bioZh", e.target.value)}
            placeholder="尚未提供"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">bio（英）</span>
          <textarea
            className="rounded border px-2 py-1"
            rows={4}
            value={form.bioEn}
            onChange={(e) => update("bioEn", e.target.value)}
            placeholder="尚未提供"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">信箱</span>
          <input
            type="email"
            className="rounded border px-2 py-1"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="尚未提供"
          />
        </label>
        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">Instagram</span>
            <input
              className="rounded border px-2 py-1"
              value={form.instagram}
              onChange={(e) => update("instagram", e.target.value)}
              placeholder="尚未提供"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-medium">Behance</span>
            <input
              className="rounded border px-2 py-1"
              value={form.behance}
              onChange={(e) => update("behance", e.target.value)}
              placeholder="尚未提供"
            />
          </label>
        </div>

        <hr />

        <ImagePicker
          label="Hero 圖 heroImageId"
          value={form.heroImageId}
          onChange={(id) => update("heroImageId", id)}
          mediaOptions={mediaOptions}
        />
        <ImagePicker
          label="About 圖 aboutImageId"
          value={form.aboutImageId}
          onChange={(id) => update("aboutImageId", id)}
          mediaOptions={mediaOptions}
        />

        <hr />

        <label className="flex flex-col gap-1">
          <span className="font-medium">SEO 標題</span>
          <input
            className="rounded border px-2 py-1"
            value={form.seoTitle}
            onChange={(e) => update("seoTitle", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">SEO 描述</span>
          <textarea
            className="rounded border px-2 py-1"
            rows={2}
            value={form.seoDescription}
            onChange={(e) => update("seoDescription", e.target.value)}
          />
        </label>
        <ImagePicker
          label="預設 OG 圖 defaultOgImageId"
          value={form.defaultOgImageId}
          onChange={(id) => update("defaultOgImageId", id)}
          mediaOptions={mediaOptions}
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
