"use client";

import { useTransition } from "react";
import { updateAwardImage, updateAwardShowCertificate } from "./actions";

interface MediaOption {
  id: string;
  filename: string | null;
  kind: string;
}

export function AwardImagePicker({
  awardId,
  currentImageId,
  mediaOptions,
}: {
  awardId: string;
  currentImageId: string | null;
  mediaOptions: MediaOption[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentImageId ?? ""}
      disabled={isPending}
      onChange={(e) => {
        const imageId = e.target.value === "" ? null : e.target.value;
        startTransition(() => {
          void updateAwardImage({ awardId, imageId });
        });
      }}
    >
      <option value="">（無圖片）</option>
      {mediaOptions.map((option) => (
        <option key={option.id} value={option.id}>
          {(option.filename ?? option.id) + " · " + option.kind}
        </option>
      ))}
    </select>
  );
}

/**
 * 是否在關於頁公開展示這筆獎項的證書——跟上面選哪張圖是兩件事（SPEC.md
 * §10.4：業主還沒決定要不要公開，「後台先存了圖」不代表「同意公開」）。
 * 預設不勾選。
 */
export function AwardCertificateToggle({
  awardId,
  showCertificate,
}: {
  awardId: string;
  showCertificate: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-1 text-xs">
      <input
        type="checkbox"
        defaultChecked={showCertificate}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.checked;
          startTransition(() => {
            void updateAwardShowCertificate({ awardId, showCertificate: next });
          });
        }}
      />
      公開展示
    </label>
  );
}
