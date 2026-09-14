import type { z } from "zod";

/**
 * 從 Zod schema（src/lib/blocks/schemas.ts 那些 config schema）反推出表單
 * 欄位描述，讓後台可以自動生成表單，不用每種區塊各寫一份。
 *
 * ⚠️ 這裡直接讀 Zod v4 內部的 `.def` 結構（`.def.type`、`.def.innerType`、
 * `.def.entries`、`.def.element`、`.shape`），不是 Zod 公開文件保證的
 * 穩定 API，是實測目前裝的 zod@4.6.2 內部長相反推出來的（見開發過程中
 * 的 tsx 腳本測試）。Zod 大版本升級時這裡可能要跟著調整——這是選擇「自動
 * 生成表單」這個方向必然要接受的代價，只是先老實寫在這裡，不要當作
 * 沒事。
 *
 * 判斷「這個 string/array 欄位是不是圖片參照」目前是用**欄位名稱包含
 * "media"**當慣例（mediaId / leftMediaId / mediaIds 都符合），schema 裡
 * 目前 12 種區塊的欄位命名全部遵守這個慣例，故意沒有另外加型別標記。
 */

export type FieldKind =
  | "text"
  | "textarea"
  | "enum"
  | "boolean"
  | "media"
  | "media-list"
  | "localized-text"
  | "unknown";

export interface FieldDescriptor {
  key: string;
  kind: FieldKind;
  options?: string[]; // kind === "enum" 時才有
  nullable: boolean;
  defaultValue: unknown;
}

function isMediaFieldName(key: string): boolean {
  return /media/i.test(key);
}

// 不透過 any 幾乎不可能表達 Zod 內部結構的型別，這裡刻意收斂在這一個
// function 裡，外部使用者拿到的是上面定義好的 FieldDescriptor，不會接觸
// 到這些內部型別。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap(schema: any): { base: any; nullable: boolean; defaultValue: unknown } {
  let current = schema;
  let nullable = false;
  let defaultValue: unknown;

  // 最多攤 10 層，正常 schema 兩三層就到底了，這個上限只是防止意外死迴圈
  for (let i = 0; i < 10; i++) {
    const t = current?.def?.type;
    if (t === "default") {
      defaultValue = current.def.defaultValue;
      current = current.def.innerType;
    } else if (t === "nullable" || t === "optional") {
      nullable = true;
      current = current.def.innerType;
    } else {
      break;
    }
  }
  return { base: current, nullable, defaultValue };
}

export function getFieldDescriptors(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any>,
): FieldDescriptor[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shape = (schema as any).shape as Record<string, any>;
  const descriptors: FieldDescriptor[] = [];

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const { base, nullable, defaultValue } = unwrap(fieldSchema);
    const baseType = base?.def?.type;

    if (baseType === "enum") {
      descriptors.push({
        key,
        kind: "enum",
        options: Object.keys(base.def.entries),
        nullable,
        defaultValue,
      });
      continue;
    }

    if (baseType === "boolean") {
      descriptors.push({ key, kind: "boolean", nullable, defaultValue });
      continue;
    }

    if (baseType === "array") {
      const elementType = base.def.element?.def?.type;
      const kind: FieldKind =
        elementType === "string" && isMediaFieldName(key) ? "media-list" : "unknown";
      descriptors.push({ key, kind, nullable, defaultValue });
      continue;
    }

    if (baseType === "object") {
      const innerShape = base.shape as Record<string, unknown> | undefined;
      const innerKeys = Object.keys(innerShape ?? {});
      const isLocalizedText =
        innerKeys.length === 2 && innerKeys.includes("en") && innerKeys.includes("zh");
      descriptors.push({
        key,
        kind: isLocalizedText ? "localized-text" : "unknown",
        nullable,
        defaultValue,
      });
      continue;
    }

    if (baseType === "string") {
      if (isMediaFieldName(key)) {
        descriptors.push({ key, kind: "media", nullable, defaultValue });
      } else {
        descriptors.push({
          key,
          kind: /text/i.test(key) ? "textarea" : "text",
          nullable,
          defaultValue,
        });
      }
      continue;
    }

    descriptors.push({ key, kind: "unknown", nullable, defaultValue });
  }

  return descriptors;
}
