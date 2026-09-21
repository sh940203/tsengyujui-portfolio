import type { S3Client } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { VARIANT_WIDTHS, type VariantWidth } from "./constants";

export type Rotation = 0 | 90 | 180 | 270;

export interface GeneratedVariant {
  width: VariantWidth;
  key: string;
}

/**
 * Pure factory, deliberately without "server-only" — the actual sharp +
 * R2-upload pipeline (SPEC.md §1.3), taking an injected S3 client/buckets
 * instead of importing the Next app's guarded singleton. Shared by
 * src/lib/media/variants.ts (the guarded version used by Server
 * Actions/Route Handlers) and scripts/ingest-assets.ts (a standalone CLI
 * script that can't resolve "server-only", which throws outside Next's
 * bundler by design).
 *
 * Generates every WebP variant (skipping any wider than the source — never
 * upscale) and uploads them to the public `bucket`, plus a private
 * `original.jpg`/`.png` copy uploaded to the separate `originalsBucket`
 * (SPEC.md §12.4 方案 A — kept out of the public bucket entirely, not just
 * a different key path). `destPrefix` should be `{slug}/{kind}/{cuid}` —
 * ASCII only, never the original filename (SPEC.md §11.2 / §12.4).
 */
export async function generateAndUploadVariants(params: {
  originalBuffer: Buffer;
  rotation: Rotation;
  destPrefix: string;
  r2: S3Client;
  bucket: string;
  originalsBucket: string;
  /**
   * 預設 true：連原檔一起上傳到私有 bucket 的 `${destPrefix}/original.*`。
   * 旋轉（重新生成變體到新前綴）時傳 false——原檔已經在基底前綴，不重複存一份。
   */
  uploadOriginal?: boolean;
  /** 只生成這些寬度（補檔用）；沒給就四個尺寸全部生成。 */
  onlyWidths?: readonly number[];
}) {
  const { originalBuffer, rotation, destPrefix, r2, bucket, originalsBucket } =
    params;
  const uploadOriginal = params.uploadOriginal ?? true;

  // 注意：sharp 的 .rotate(deg).metadata() 不會反映旋轉後的尺寸——metadata()
  // 讀的是來源檔頭，不會執行 pending 的 rotate 操作，90°/270° 時寬高仍是
  // 「轉正前」的值（實測過：.rotate(90).metadata() 回傳原始 3510x2482，
  // 但實際輸出的圖檔是 2482x3510）。用不帶 rotate 的 metadata 拿到原始寬高，
  // 90°/270° 時自己對調，才是轉正後的正確尺寸。
  const rawMeta = await sharp(originalBuffer).metadata();
  const isSwapped = rotation === 90 || rotation === 270;
  const finalWidth = isSwapped ? (rawMeta.height ?? 0) : (rawMeta.width ?? 0);
  const finalHeight = isSwapped ? (rawMeta.width ?? 0) : (rawMeta.height ?? 0);

  const variants: GeneratedVariant[] = [];
  let totalUploadedBytes = 0;

  // 四個尺寸的檔案「一律都要存在」：圖片載入器（`image-loader.ts`）只會挑
  // 「大於等於需求寬度的下一檔」，如果小原檔（例如 1066px 寬的手繪稿照片）
  // 少了 1600/2400，高解析度大螢幕要求的寬度超過 800 時就會去要不存在的檔案
  // 而 404（2026-09-21 使用者回報 Cumedy 手繪稿破圖）。原本這裡對「原圖比
  // 目標小」是直接跳過該變體；現在改成照樣生成，但 `withoutEnlargement`
  // 保證不放大畫素——大尺寸的檔案就是原始尺寸的那份，瀏覽器自己縮放顯示。
  const wanted = params.onlyWidths
    ? VARIANT_WIDTHS.filter((w) => params.onlyWidths!.includes(w))
    : VARIANT_WIDTHS;
  for (const width of wanted) {
    const outBuffer = await sharp(originalBuffer)
      .rotate(rotation)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      // 注意：不可用 .withMetadata({ icc: 'srgb' })——那個呼叫會連同來源的
      // EXIF 一起保留下來。.withIccProfile() 是獨立方法，只處理色彩描述檔，
      // 不會連帶保留 EXIF／GPS（sharp 預設本來就不保留任何 metadata，
      // 只要不呼叫 withMetadata/keepExif 一類的方法即可）。
      .withIccProfile("srgb")
      .toBuffer();

    const key = `${destPrefix}/${width}.webp`;
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: outBuffer,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    variants.push({ width, key });
    totalUploadedBytes += outBuffer.byteLength;
  }

  // 原檔保留供後台取用，上傳至獨立的私有 bucket（不是公開 bucket 底下的路徑）
  const originalExt = rawMeta.format === "png" ? "png" : "jpg";
  const originalKey = `${destPrefix}/original.${originalExt}`;
  if (uploadOriginal) {
    await r2.send(
      new PutObjectCommand({
        Bucket: originalsBucket,
        Key: originalKey,
        Body: originalBuffer,
        ContentType: originalExt === "png" ? "image/png" : "image/jpeg",
      }),
    );
    totalUploadedBytes += originalBuffer.byteLength;
  }

  return {
    variants,
    originalKey,
    width: finalWidth || null,
    height: finalHeight || null,
    totalUploadedBytes,
  };
}
