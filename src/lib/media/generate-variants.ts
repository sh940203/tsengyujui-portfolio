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
}) {
  const { originalBuffer, rotation, destPrefix, r2, bucket, originalsBucket } =
    params;

  // 注意：sharp 的 .rotate(deg).metadata() 不會反映旋轉後的尺寸——metadata()
  // 讀的是來源檔頭，不會執行 pending 的 rotate 操作，90°/270° 時寬高仍是
  // 「轉正前」的值（實測過：.rotate(90).metadata() 回傳原始 3510x2482，
  // 但實際輸出的圖檔是 2482x3510）。用不帶 rotate 的 metadata 拿到原始寬高，
  // 90°/270° 時自己對調，才是轉正後的正確尺寸。
  const rawMeta = await sharp(originalBuffer).metadata();
  const isSwapped = rotation === 90 || rotation === 270;
  const finalWidth = isSwapped ? (rawMeta.height ?? 0) : (rawMeta.width ?? 0);
  const finalHeight = isSwapped ? (rawMeta.width ?? 0) : (rawMeta.height ?? 0);
  const srcWidth = finalWidth;

  const variants: GeneratedVariant[] = [];
  let totalUploadedBytes = 0;

  for (const width of VARIANT_WIDTHS) {
    if (srcWidth && srcWidth < width) continue; // 若原圖寬度小於目標尺寸，不放大

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
  await r2.send(
    new PutObjectCommand({
      Bucket: originalsBucket,
      Key: originalKey,
      Body: originalBuffer,
      ContentType: originalExt === "png" ? "image/png" : "image/jpeg",
    }),
  );
  totalUploadedBytes += originalBuffer.byteLength;

  return {
    variants,
    originalKey,
    width: finalWidth || null,
    height: finalHeight || null,
    totalUploadedBytes,
  };
}
