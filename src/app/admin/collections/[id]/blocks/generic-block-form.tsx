"use client";

import { useEffect, useState, useTransition } from "react";
import { getFieldDescriptors } from "@/lib/blocks/form-schema";
import { BLOCK_CONFIG_SCHEMAS, type BlockType } from "@/lib/blocks/schemas";
import { MediaMultiPicker, MediaPicker, type MediaOption } from "@/components/admin/media-picker";

/**
 * 從 Zod schema 自動生成的表單——目前只有 full-bleed / statement / spacer
 * 這三種區塊在用（見 SortableBlockRow 的判斷），驗證這套機制成不成立。
 * 其餘 9 種區塊還是走舊的通用 JSON textarea，等這三種測過沒問題再決定要
 * 不要照同樣模式展開。
 *
 * 存檔時送出的是使用者在表單上組出來的物件，真正的格式驗證仍然是
 * server action（updateBlockConfig）用該區塊 type 對應的 Zod schema 做，
 * 這裡的表單本身不是驗證的最後一道防線。
 */
export function GenericBlockForm({
  type,
  initialConfig,
  mediaOptions,
  onSave,
  onChange,
  onSaved,
}: {
  type: BlockType;
  initialConfig: Record<string, unknown>;
  mediaOptions: MediaOption[];
  onSave: (config: unknown) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** 每次表單值變動（含掛載時的初始值）都會呼叫一次，純粹供外部觀察目前
   * 未存檔的即時內容（例如即時預覽）——不影響存檔流程，`onSave` 才是唯一
   * 真正寫入資料庫的路徑。 */
  onChange?: (config: Record<string, unknown>) => void;
  /** 只在 `onSave` 回傳成功時呼叫一次，純粹通知外部「剛剛真的存檔成功
   * 了」（例如拿去做「有未發布的變更」的樂觀更新）——不影響存檔流程本身。 */
  onSaved?: () => void;
}) {
  const fields = getFieldDescriptors(BLOCK_CONFIG_SCHEMAS[type]);
  const [values, setValues] = useState<Record<string, unknown>>(initialConfig);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    onChange?.(values);
    // onChange 刻意不放進 deps：父層每次 render 都會傳入新的函式參考，
    // 放進去只會讓這個 effect 在 values 沒變時也重跑，沒有實質好處。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  function update(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await onSave(values);
      setMessage(
        result.ok ? { type: "ok", text: "已儲存" } : { type: "error", text: result.error },
      );
      if (result.ok) {
        onSaved?.();
      }
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-3">
      {fields.map((field) => {
        const value = values[field.key];
        return (
          <div key={field.key} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-500">{field.key}</span>

            {field.kind === "enum" && (
              <select
                className="rounded border px-2 py-1"
                value={(value as string) ?? ""}
                onChange={(e) => update(field.key, e.target.value)}
              >
                {field.options!.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {field.kind === "boolean" && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!value}
                  onChange={(e) => update(field.key, e.target.checked)}
                />
                <span>{value ? "開" : "關"}</span>
              </label>
            )}

            {field.kind === "text" && (
              <input
                className="rounded border px-2 py-1"
                value={(value as string) ?? ""}
                onChange={(e) => update(field.key, e.target.value)}
              />
            )}

            {field.kind === "textarea" && (
              <textarea
                className="rounded border px-2 py-1"
                rows={3}
                value={(value as string) ?? ""}
                onChange={(e) => update(field.key, e.target.value)}
              />
            )}

            {field.kind === "localized-text" && (
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded border px-2 py-1"
                  placeholder="EN"
                  value={(value as { en?: string })?.en ?? ""}
                  onChange={(e) =>
                    update(field.key, { ...(value as object), en: e.target.value })
                  }
                />
                <input
                  className="flex-1 rounded border px-2 py-1"
                  placeholder="ZH"
                  value={(value as { zh?: string })?.zh ?? ""}
                  onChange={(e) =>
                    update(field.key, { ...(value as object), zh: e.target.value })
                  }
                />
              </div>
            )}

            {field.kind === "media" && (
              <MediaPicker
                value={(value as string | null) ?? null}
                onChange={(id) => update(field.key, id)}
                mediaOptions={mediaOptions}
              />
            )}

            {field.kind === "media-list" && (
              <MediaMultiPicker
                value={(value as string[]) ?? []}
                onChange={(ids) => update(field.key, ids)}
                mediaOptions={mediaOptions}
              />
            )}

            {field.kind === "unknown" && (
              <span className="text-xs text-red-500">
                （這個欄位目前的表單產生器還不支援，型別辨識不出來）
              </span>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="self-start rounded border px-3 py-1 disabled:opacity-50"
        >
          {isPending ? "儲存中…" : "儲存設定"}
        </button>
        {message && (
          <span className={message.type === "ok" ? "text-green-600" : "text-red-600"}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
