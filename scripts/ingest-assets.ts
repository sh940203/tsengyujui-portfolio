/**
 * SPEC.md §11.3 — 素材匯入腳本。三個模式：
 *
 *   pnpm tsx scripts/ingest-assets.ts --scan
 *     遞迴掃描 ASSET_SOURCE_DIR，讀取每張圖片的尺寸與內容 sha256，
 *     「推測」collection / kind / rotation / include，輸出
 *     ingest-manifest.json 供人工核對、編輯。不上傳、不寫資料庫。
 *
 *   pnpm tsx scripts/ingest-assets.ts --contact-sheet
 *     讀取 ingest-manifest.json（人工編輯過的版本也適用），每個
 *     collection 各出一張 contact-sheet-{collection}.jpg 縮圖總覽，
 *     方便肉眼核對 --scan 的猜測是否正確，再決定要不要把某幾筆的
 *     include 改成 false。不上傳、不寫資料庫。
 *
 *   pnpm tsx scripts/ingest-assets.ts --apply [--force]
 *     讀取 ingest-manifest.json 並以 Zod 驗證，跳過 include:false，
 *     其餘每筆套用 rotation、生成多尺寸 WebP + 私有原檔、上傳 R2、
 *     寫入 media 表（collection 對應的 collections 列不存在時建立
 *     draft 佔位列）。以 sha256 記錄進度到 .ingest-apply-state.json，
 *     可中斷續傳；單筆失敗記錄後繼續，最後統一報告。若仍有未
 *     "confirmed" 的項目會中止並要求 --force。
 *
 * ── 對應表如何得出 ──
 * 實際資料夾層級是 `{系列資料夾}/{子資料夾}/{檔案}`，同一系列的
 * final/sketch/poster 全部混在同一個子資料夾內，無法像 SPEC.md §11.3
 * 原本假設的那樣單靠資料夾路徑判斷 kind。scan 產生的是起始猜測值
 * （檔名／方向規則），實際分類已由人工逐張目視 manifest 與 contact
 * sheet 校正過，所有項目皆已標記 "confidence": "confirmed"。
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { ASSET_SOURCE_DIR } from "../src/lib/constants";
import { createDb } from "../src/lib/db/create-client";
import { collections, media } from "../src/lib/db/schema";
import { generateAndUploadVariants } from "../src/lib/media/generate-variants";
import { createR2Client } from "../src/lib/r2/create-client";

// 獨立腳本不透過 Next.js 執行，無法解析 Next app 內用 "server-only" 保護的
// db/client.ts、r2/client.ts（該套件在非 Next 環境下會直接 throw）。改用
// 不受保護的 pure factory，只在 --apply 真正需要時才建立（--scan /
// --contact-sheet 不需要憑證，不應該因為 env 是空字串就建立失敗）。
let dbInstance: ReturnType<typeof createDb> | undefined;
let r2Instance: ReturnType<typeof createR2Client> | undefined;
let r2Bucket = "";
let r2OriginalsBucket = "";

function initApplyClients(): void {
  dbInstance = createDb({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  r2Instance = createR2Client({
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  });
  r2Bucket = process.env.R2_BUCKET_NAME!;
  // 私有 bucket，只放 original.*，跟公開的 r2Bucket 完全分開（SPEC.md §12.4 方案 A）
  r2OriginalsBucket = process.env.R2_ORIGINALS_BUCKET_NAME!;
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

// 明確排除：純粹是設計靈感／競品截圖，不屬於作品集素材 — 使用者指定排除
const EXCLUDED_TOP_LEVEL_DIRS = new Set(["web參考圖"]);

// 頂層資料夾 → collection slug。null 表示該資料夾內容不屬於任何系列
// （例如「獎狀」只是獎狀圖檔，media 表沒有對應欄位可掛載）。
const COLLECTION_FOLDER_MAP: Record<string, string | null> = {
  "Comedy Night": "cumedy-night",
  "Alone on the last pure land": "pure-land",
  "X-venom": "x-venom",
  獎狀: null,
};

type MediaKind = "final" | "detail" | "sketch" | "poster" | "process" | "misc";
type Rotation = 0 | 90 | 180 | 270;
type Confidence = "guess" | "confirmed";

interface ManifestItem {
  sourcePath: string;
  filename: string;
  topFolder: string;
  collection: string | null;
  fileSize: number;
  sha256: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  kind: MediaKind;
  rotation: Rotation;
  confidence: Confidence;
  include: boolean;
  sortOrder: number;
  altEn: string;
  altZh: string;
  note?: string;
}

const KNOWN_COLLECTIONS = ["cumedy-night", "pure-land", "x-venom"] as const;

const ManifestItemSchema = z.object({
  sourcePath: z.string(),
  filename: z.string(),
  topFolder: z.string().optional(),
  collection: z.enum(KNOWN_COLLECTIONS).nullable(),
  fileSize: z.number(),
  sha256: z.string().length(64),
  width: z.number().nullable(),
  height: z.number().nullable(),
  mimeType: z.string(),
  kind: z.enum(["final", "detail", "sketch", "poster", "process", "misc"]),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  confidence: z.enum(["guess", "confirmed"]),
  include: z.boolean(),
  sortOrder: z.number(),
  altEn: z.string(),
  altZh: z.string(),
  note: z.string().optional(),
});

const ManifestSchema = z.object({
  generatedAt: z.string(),
  sourceDir: z.string(),
  items: z.array(ManifestItemSchema),
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * 依系列 + 檔名 + 圖片方向推測 kind / rotation。每個分支旁註記推測依據。
 */
function guessKindAndRotation(
  collection: string | null,
  filename: string,
  width: number,
  height: number,
): { kind: MediaKind; rotation: Rotation } {
  const isLandscape = width > 0 && height > 0 && width > height;

  if (collection === "cumedy-night") {
    // DSC*.jpg — 相機直出的成品照
    if (/^DSC/i.test(filename)) return { kind: "final", rotation: 0 };
    // 618.jpg — 目視確認為浴室鏡面 "Cumedy" 口紅字跡的成品照
    if (/^618\./i.test(filename)) return { kind: "final", rotation: 0 };
    // 未命名的作品* — 目視確認為 CUM.N 保險套包裝平面設計
    if (/^未命名的作品/.test(filename)) return { kind: "poster", rotation: 0 };
    // IMG_17xx / IMG_38xx / UUID 檔名 — 目視確認為手繪／設計牆手稿照片
    if (/^IMG_(17|38)\d+/.test(filename) || UUID_PATTERN.test(filename)) {
      return { kind: "sketch", rotation: 0 };
    }
    return { kind: "misc", rotation: 0 };
  }

  if (collection === "pure-land") {
    // Capture One Catalog* — 成品照
    if (/^Capture One Catalog/i.test(filename)) {
      return { kind: "final", rotation: 0 };
    }
    if (/^IMG_08\d+/.test(filename)) {
      // 橫躺的是掃描手繪稿（SPEC §11.3 step 6 原文規則），直立的目視
      // 確認是成品照（IMG_0848 / IMG_0864 皆為完整成品大片）
      return isLandscape
        ? { kind: "sketch", rotation: 90 }
        : { kind: "final", rotation: 0 };
    }
    // IMG_18xx — 情境／過程照
    if (/^IMG_18\d+/.test(filename)) return { kind: "process", rotation: 0 };
    return { kind: "misc", rotation: 0 };
  }

  if (collection === "x-venom") {
    // Capture One Catalog* — 成品照
    if (/^Capture One Catalog/i.test(filename)) {
      return { kind: "final", rotation: 0 };
    }
    // IMG_0865 / IMG_0867 — 目視確認為海報本體（黑底球形鏡頭構圖；
    // 0867 疊有「X VENOM」破碎筆刷字），SPEC.md 原先假設的 IMG_1824/1826
    // 目視後其實是成品照，海報實際檔名是這兩張
    if (/^IMG_086[57]\./i.test(filename)) return { kind: "poster", rotation: 0 };
    // 其餘 IMG_08xx / IMG_18xx 目視確認皆為成品照（IMG_0859/0868/1824/1826）
    if (/^IMG_(08|18)\d+/.test(filename)) return { kind: "final", rotation: 0 };
    return { kind: "misc", rotation: 0 };
  }

  // 獎狀 或任何未知資料夾
  return { kind: "misc", rotation: 0 };
}

function listImageFiles(rootDir: string): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue; // .DS_Store 等
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  };
  walk(rootDir);
  return results;
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function mimeTypeFor(filename: string): string {
  return filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

async function scan(): Promise<ManifestItem[]> {
  if (!fs.existsSync(ASSET_SOURCE_DIR)) {
    console.error(`找不到素材來源目錄：${ASSET_SOURCE_DIR}`);
    process.exit(1);
  }

  const items: ManifestItem[] = [];
  const sortCounters = new Map<string, number>();
  const topEntries = fs
    .readdirSync(ASSET_SOURCE_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."));

  for (const topEntry of topEntries) {
    if (EXCLUDED_TOP_LEVEL_DIRS.has(topEntry.name)) {
      console.log(`跳過（排除清單）：${topEntry.name}/`);
      continue;
    }

    const collection = Object.hasOwn(COLLECTION_FOLDER_MAP, topEntry.name)
      ? COLLECTION_FOLDER_MAP[topEntry.name]
      : null;
    if (!Object.hasOwn(COLLECTION_FOLDER_MAP, topEntry.name)) {
      console.warn(`⚠️  未知資料夾（不在對應表中，將標記 collection=null）：${topEntry.name}/`);
    }

    const topDir = path.join(ASSET_SOURCE_DIR, topEntry.name);
    for (const filePath of listImageFiles(topDir)) {
      const filename = path.basename(filePath);
      const stat = fs.statSync(filePath);

      let width: number | null = null;
      let height: number | null = null;
      try {
        const meta = await sharp(filePath).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
      } catch {
        console.warn(`⚠️  無法讀取圖片尺寸：${filePath}`);
      }

      const { kind, rotation } = guessKindAndRotation(
        collection,
        filename,
        width ?? 0,
        height ?? 0,
      );

      const sortKey = collection ?? "(none)";
      const sortOrder = (sortCounters.get(sortKey) ?? 0) + 1;
      sortCounters.set(sortKey, sortOrder);

      items.push({
        sourcePath: path.relative(ASSET_SOURCE_DIR, filePath),
        filename,
        topFolder: topEntry.name,
        collection,
        fileSize: stat.size,
        sha256: sha256File(filePath),
        width,
        height,
        mimeType: mimeTypeFor(filename),
        kind,
        rotation,
        confidence: "guess",
        include: true,
        sortOrder,
        altEn: "",
        altZh: "",
      });
    }
  }

  return items;
}

function printStats(items: ManifestItem[]): void {
  console.log("\n=== 各系列 × kind 統計 ===");
  const grouped = new Map<string, Map<MediaKind, number>>();
  for (const item of items) {
    const col = item.collection ?? "(無對應系列)";
    if (!grouped.has(col)) grouped.set(col, new Map());
    const kindMap = grouped.get(col)!;
    kindMap.set(item.kind, (kindMap.get(item.kind) ?? 0) + 1);
  }
  for (const [col, kindMap] of [...grouped.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.log(`\n[${col}]`);
    let total = 0;
    for (const [kind, count] of [...kindMap.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      console.log(`  ${kind.padEnd(10)} ${count}`);
      total += count;
    }
    console.log(`  ${"total".padEnd(10)} ${total}`);
  }

  console.log("\n=== 推測需旋轉的檔案（rotation !== 0） ===");
  const needsRotation = items.filter((i) => i.rotation !== 0);
  if (needsRotation.length === 0) {
    console.log("  （無）");
  } else {
    for (const item of needsRotation) {
      console.log(
        `  [${item.collection ?? "?"}] ${item.sourcePath} → rotation=${item.rotation}° (${item.width}x${item.height})`,
      );
    }
  }

  console.log(`\n總計掃描 ${items.length} 個檔案。`);
}

// ── Contact sheet ──────────────────────────────────────────────────

const SHEET_COLS = 6;
const THUMB_WIDTH = 200;
const THUMB_MAX_HEIGHT = 300; // 縮圖以「不裁切、置中」的方式塞進這個框
const CELL_PADDING = 14;
const LABEL_LINE_HEIGHT = 16;
const LABEL_LINES = 3; // 檔名 / kind / rotation（無旋轉時該行留空，維持對齊）
const CELL_WIDTH = THUMB_WIDTH + CELL_PADDING * 2;
const CELL_HEIGHT =
  THUMB_MAX_HEIGHT + CELL_PADDING * 2 + LABEL_LINES * LABEL_LINE_HEIGHT;
const INCLUDE_FALSE_BORDER = "#e11d1d";

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// SVG 沒有簡單的自動換行/截斷，寬度用「CJK 算 2、其餘算 1」粗估字寬後裁切
function truncateForLabel(input: string, maxUnits = 26): string {
  let units = 0;
  let result = "";
  for (const ch of input) {
    units += /[　-鿿＀-￯]/.test(ch) ? 2 : 1;
    if (units > maxUnits) return result + "…";
    result += ch;
  }
  return result;
}

async function buildThumb(
  absPath: string,
  rotation: Rotation,
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  try {
    const resized = await sharp(absPath)
      .rotate(rotation)
      .resize({
        width: THUMB_WIDTH,
        height: THUMB_MAX_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: resized.data,
      width: resized.info.width,
      height: resized.info.height,
    };
  } catch (err) {
    console.warn(`⚠️  無法產生縮圖：${absPath}（${(err as Error).message}）`);
    return null;
  }
}

async function generateContactSheetForCollection(
  collectionKey: string,
  items: ManifestItem[],
): Promise<void> {
  const rows = Math.ceil(items.length / SHEET_COLS);
  const sheetWidth = SHEET_COLS * CELL_WIDTH;
  const sheetHeight = rows * CELL_HEIGHT;

  const svgParts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}">`,
    `<rect x="0" y="0" width="${sheetWidth}" height="${sheetHeight}" fill="#ffffff" />`,
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const col = i % SHEET_COLS;
    const row = Math.floor(i / SHEET_COLS);
    const cellX = col * CELL_WIDTH;
    const cellY = row * CELL_HEIGHT;

    const absPath = path.join(ASSET_SOURCE_DIR, item.sourcePath);
    const thumb = await buildThumb(absPath, item.rotation);

    const boxX = cellX + CELL_PADDING;
    const boxY = cellY + CELL_PADDING;

    if (thumb) {
      // 置中塞進 THUMB_WIDTH x THUMB_MAX_HEIGHT 的框內
      const offsetX = boxX + (THUMB_WIDTH - thumb.width) / 2;
      const offsetY = boxY + (THUMB_MAX_HEIGHT - thumb.height) / 2;
      const base64 = thumb.buffer.toString("base64");

      svgParts.push(
        `<image x="${offsetX}" y="${offsetY}" width="${thumb.width}" height="${thumb.height}" xlink:href="data:image/jpeg;base64,${base64}" />`,
      );

      if (item.include === false) {
        svgParts.push(
          `<rect x="${offsetX - 3}" y="${offsetY - 3}" width="${thumb.width + 6}" height="${thumb.height + 6}" fill="none" stroke="${INCLUDE_FALSE_BORDER}" stroke-width="4" />`,
        );
      }
    } else {
      svgParts.push(
        `<rect x="${boxX}" y="${boxY}" width="${THUMB_WIDTH}" height="${THUMB_MAX_HEIGHT}" fill="#eeeeee" stroke="#cccccc" />`,
        `<text x="${boxX + THUMB_WIDTH / 2}" y="${boxY + THUMB_MAX_HEIGHT / 2}" font-size="12" text-anchor="middle" fill="#999999">讀取失敗</text>`,
      );
    }

    const nameNoExt = item.filename.replace(/\.[^.]+$/, "");
    const labelX = cellX + CELL_WIDTH / 2;
    let labelY = cellY + CELL_PADDING + THUMB_MAX_HEIGHT + LABEL_LINE_HEIGHT;

    svgParts.push(
      `<text x="${labelX}" y="${labelY}" font-family="-apple-system, PingFang TC, Heiti TC, sans-serif" font-size="12" text-anchor="middle" fill="#111111">${escapeXml(truncateForLabel(nameNoExt))}</text>`,
    );
    labelY += LABEL_LINE_HEIGHT;
    svgParts.push(
      `<text x="${labelX}" y="${labelY}" font-family="-apple-system, PingFang TC, Heiti TC, sans-serif" font-size="12" text-anchor="middle" fill="#555555">${escapeXml(item.kind)}</text>`,
    );
    labelY += LABEL_LINE_HEIGHT;
    if (item.rotation !== 0) {
      svgParts.push(
        `<text x="${labelX}" y="${labelY}" font-family="-apple-system, PingFang TC, Heiti TC, sans-serif" font-size="12" text-anchor="middle" fill="#b45309">rotation: ${item.rotation}°</text>`,
      );
    }
  }

  svgParts.push("</svg>");
  const svg = svgParts.join("\n");

  const outPath = path.join(
    process.cwd(),
    `contact-sheet-${collectionKey}.jpg`,
  );
  await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(outPath);
  console.log(`已輸出：${outPath}（${items.length} 張）`);
}

async function contactSheet(): Promise<void> {
  const manifestPath = path.join(process.cwd(), "ingest-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(
      `找不到 ${manifestPath}，請先執行 pnpm tsx scripts/ingest-assets.ts --scan`,
    );
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
    items: ManifestItem[];
  };

  const grouped = new Map<string, ManifestItem[]>();
  for (const item of manifest.items) {
    const key = item.collection ?? "unassigned";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  for (const [collectionKey, items] of [...grouped.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    await generateContactSheetForCollection(collectionKey, items);
  }
}

// ── Apply ──────────────────────────────────────────────────────────

const STATE_FILE = path.join(process.cwd(), ".ingest-apply-state.json");
const REQUIRED_APPLY_ENV = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_ORIGINALS_BUCKET_NAME",
  "TURSO_DATABASE_URL",
] as const;

// SPEC.md §10.1 的系列標題，用於 collections 尚不存在時建立 draft 佔位列
// （素材匯入排在內容 seed 之前，見 §11 開頭說明）
const COLLECTION_TITLE_EN: Record<string, string> = {
  "cumedy-night": "Cumedy Night",
  "pure-land": "Alone on the Last Pure Land",
  "x-venom": "X-venom",
};

interface ApplyStateEntry {
  mediaId: string;
  destPrefix: string;
  completedAt: string;
}
type ApplyState = Record<string, ApplyStateEntry>; // sha256 → entry

function loadState(): ApplyState {
  if (!fs.existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as ApplyState;
  } catch {
    return {};
  }
}

function saveState(state: ApplyState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function missingApplyEnv(): string[] {
  return REQUIRED_APPLY_ENV.filter((key) => !process.env[key]);
}

async function ensureCollectionId(
  slug: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(slug);
  if (cached) return cached;

  const existing = await dbInstance!
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);

  if (existing[0]) {
    cache.set(slug, existing[0].id);
    return existing[0].id;
  }

  const id = createId();
  await dbInstance!.insert(collections).values({
    id,
    slug,
    titleEn: COLLECTION_TITLE_EN[slug] ?? slug,
    theme: "dark",
    visibility: "draft",
  });
  console.log(`  （collections 尚無 "${slug}"，已建立 draft 佔位列）`);
  cache.set(slug, id);
  return id;
}

async function applyItem(
  item: ManifestItem,
  collectionIdCache: Map<string, string>,
): Promise<{ mediaId: string; destPrefix: string; objectCount: number; uploadedBytes: number }> {
  const absPath = path.join(ASSET_SOURCE_DIR, item.sourcePath);
  const originalBuffer = fs.readFileSync(absPath);

  const cuid = createId();
  const slugSegment = item.collection ?? "unassigned";
  const destPrefix = `${slugSegment}/${item.kind}/${cuid}`;

  const result = await generateAndUploadVariants({
    originalBuffer,
    rotation: item.rotation,
    destPrefix,
    r2: r2Instance!,
    bucket: r2Bucket,
    originalsBucket: r2OriginalsBucket,
  });

  let collectionId: string | null = null;
  if (item.collection) {
    collectionId = await ensureCollectionId(item.collection, collectionIdCache);
  }

  const mediaId = createId();
  await dbInstance!.insert(media).values({
    id: mediaId,
    r2Key: destPrefix,
    filename: item.filename,
    mimeType: item.mimeType,
    width: result.width,
    height: result.height,
    fileSize: item.fileSize,
    rotation: item.rotation,
    altEn: item.altEn || null,
    altZh: item.altZh || null,
    collectionId,
    kind: item.kind,
    sortOrder: item.sortOrder,
  });

  return {
    mediaId,
    destPrefix,
    objectCount: result.variants.length + 1, // + original
    uploadedBytes: result.totalUploadedBytes,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function printApplyReport(report: {
  succeeded: ManifestItem[];
  failed: { item: ManifestItem; error: string }[];
  skippedCount: number;
  dedupedCount: number;
  rotatedCount: number;
  r2ObjectCount: number;
  uploadedBytes: number;
}): void {
  console.log("\n✓ 匯入完成\n");

  const grouped = new Map<string, Map<MediaKind, number>>();
  for (const item of report.succeeded) {
    const col = item.collection ?? "(無對應系列)";
    if (!grouped.has(col)) grouped.set(col, new Map());
    const km = grouped.get(col)!;
    km.set(item.kind, (km.get(item.kind) ?? 0) + 1);
  }
  for (const [col, km] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const parts = [...km.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kind, count]) => `${kind} ${count}`)
      .join("  ");
    console.log(`  ${col.padEnd(14)}  ${parts}`);
  }

  console.log(`\n  已套用旋轉      ${report.rotatedCount} 張`);
  console.log(`  略過（include:false）  ${report.skippedCount} 張`);
  console.log(`  略過（已處理過/重複）  ${report.dedupedCount} 張`);
  console.log(`  失敗            ${report.failed.length} 張`);
  console.log(`\n  R2 物件數       ${report.r2ObjectCount}`);
  console.log(`  總上傳量        ${formatBytes(report.uploadedBytes)}`);

  if (report.failed.length > 0) {
    console.log("\n失敗清單：");
    for (const { item, error } of report.failed) {
      console.log(`  [${item.collection ?? "?"}] ${item.sourcePath} — ${error}`);
    }
  }
}

async function apply(force: boolean): Promise<void> {
  const manifestPath = path.join(process.cwd(), "ingest-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(
      `找不到 ${manifestPath}，請先執行 pnpm tsx scripts/ingest-assets.ts --scan`,
    );
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("⚠️  manifest 格式不符合 Zod schema：");
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
  }
  const items = parsed.data.items as ManifestItem[];

  const missingEnv = missingApplyEnv();
  if (missingEnv.length > 0) {
    console.error(`⚠️  缺少必要環境變數，無法上傳 R2 / 寫入資料庫：`);
    for (const key of missingEnv) console.error(`  - ${key}`);
    console.error("\n請先在 .env.local 填入真實的 Turso 與 Cloudflare R2 憑證後再試。");
    process.exit(1);
  }

  const included = items.filter((i) => i.include);
  const skippedCount = items.length - included.length;

  const unconfirmed = included.filter((i) => i.confidence !== "confirmed");
  if (unconfirmed.length > 0 && !force) {
    console.error(
      `\n⚠️  有 ${unconfirmed.length} 筆 include:true 的項目仍是 "confidence": "guess"：`,
    );
    for (const item of unconfirmed.slice(0, 20)) {
      console.error(`  [${item.collection ?? "?"}] ${item.sourcePath}`);
    }
    if (unconfirmed.length > 20) {
      console.error(`  ...其餘 ${unconfirmed.length - 20} 筆`);
    }
    console.error("\n請先人工核對這些項目並改為 confirmed，或加上 --force 強制繼續。");
    process.exit(1);
  }

  initApplyClients();
  const state = loadState();
  const collectionIdCache = new Map<string, string>();

  const succeeded: ManifestItem[] = [];
  const failed: { item: ManifestItem; error: string }[] = [];
  let dedupedCount = 0;
  let rotatedCount = 0;
  let r2ObjectCount = 0;
  let uploadedBytes = 0;

  for (let i = 0; i < included.length; i++) {
    const item = included[i];
    const progress = `[${i + 1}/${included.length}]`;

    if (state[item.sha256]) {
      console.log(`${progress} ${item.filename} — 已處理過（sha256 相符），略過`);
      dedupedCount++;
      continue;
    }

    console.log(`${progress} ${item.filename} — 處理中...`);
    try {
      const result = await applyItem(item, collectionIdCache);
      state[item.sha256] = {
        mediaId: result.mediaId,
        destPrefix: result.destPrefix,
        completedAt: new Date().toISOString(),
      };
      saveState(state); // 逐筆寫入，確保中斷後可續傳
      succeeded.push(item);
      if (item.rotation !== 0) rotatedCount++;
      r2ObjectCount += result.objectCount;
      uploadedBytes += result.uploadedBytes;
      console.log(`${progress} ${item.filename} — 完成（${result.destPrefix}）`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${progress} ${item.filename} — 失敗：${message}`);
      failed.push({ item, error: message });
    }
  }

  printApplyReport({
    succeeded,
    failed,
    skippedCount,
    dedupedCount,
    rotatedCount,
    r2ObjectCount,
    uploadedBytes,
  });
}

// ── CLI ────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--scan")) {
    console.log(`掃描來源：${ASSET_SOURCE_DIR}\n`);

    const items = await scan();

    const manifest = {
      generatedAt: new Date().toISOString(),
      sourceDir: ASSET_SOURCE_DIR,
      excludedTopLevelDirs: [...EXCLUDED_TOP_LEVEL_DIRS],
      totalFiles: items.length,
      items,
    };

    const outPath = path.join(process.cwd(), "ingest-manifest.json");
    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), "utf-8");

    printStats(items);
    console.log(`\n已輸出 manifest：${outPath}`);
    return;
  }

  if (args.includes("--contact-sheet")) {
    await contactSheet();
    return;
  }

  if (args.includes("--apply")) {
    await apply(args.includes("--force"));
    return;
  }

  console.error(
    "目前實作的模式：\n" +
      "  pnpm tsx scripts/ingest-assets.ts --scan\n" +
      "  pnpm tsx scripts/ingest-assets.ts --contact-sheet\n" +
      "  pnpm tsx scripts/ingest-assets.ts --apply [--force]",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
