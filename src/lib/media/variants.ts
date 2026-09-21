import "server-only";
import { r2, R2_BUCKET, R2_ORIGINALS_BUCKET } from "@/lib/r2/client";
import {
  generateAndUploadVariants as generateAndUploadVariantsPure,
  type Rotation,
} from "./generate-variants";
import { VARIANT_WIDTHS, type VariantWidth } from "./constants";

export { VARIANT_WIDTHS };
export type { VariantWidth, Rotation };

/**
 * SPEC.md §1.3 — 匯入 / 上傳時預生成的尺寸，不做請求時即時轉檔。
 * Thin wrapper around the pure pipeline in ./generate-variants, bound to
 * this app's R2 singleton, for use from Server Actions / Route Handlers.
 */
export async function generateAndUploadVariants(params: {
  originalBuffer: Buffer;
  rotation: Rotation;
  destPrefix: string;
  uploadOriginal?: boolean;
  onlyWidths?: readonly number[];
}) {
  return generateAndUploadVariantsPure({
    ...params,
    r2,
    bucket: R2_BUCKET,
    originalsBucket: R2_ORIGINALS_BUCKET,
  });
}
