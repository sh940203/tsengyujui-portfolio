import { z } from "zod";

/**
 * SPEC.md §3 — 12 種區塊的 config schema。§12.5 明文要求：讀取與寫入
 * blocks.config 都必須經過對應的 Zod schema，不可以直接 JSON.parse() 後
 * 信任內容。這個檔案是唯一的 schema 來源，Server Actions 讀寫都從這裡拿。
 *
 * 媒材欄位（mediaId / mediaIds）刻意做成可為空（null / []），因為「新增
 * 區塊」這個動作在還沒有逐區塊編輯表單（那是下一批要做的）之前，需要能
 * 產生一個通過驗證的空白 config——新增當下不會有使用者已經選好的圖片。
 * 版面/風格類的 enum 欄位就沒有這個問題，一律給一個明確預設值。
 */

const LocalizedText = z.object({
  en: z.string().default(""),
  zh: z.string().default(""),
});

const mediaIdField = z.string().cuid2().nullable().default(null);
const mediaIdsField = z.array(z.string().cuid2()).default([]);

export const BlockTypeEnum = z.enum([
  "full-bleed",
  "single",
  "pair",
  "triptych",
  "statement",
  "text-image",
  "detail-strip",
  "sketch-cluster",
  "spacer",
  "divider",
  "lens",
  "mirror",
]);
export type BlockType = z.infer<typeof BlockTypeEnum>;

// 3.1 full-bleed（滿版單圖）
export const FullBleedConfigSchema = z.object({
  mediaId: mediaIdField,
  height: z.enum(["screen", "large", "auto"]).default("screen"),
  overlayText: LocalizedText.default({ en: "", zh: "" }),
  overlayPosition: z
    .enum(["center", "bottom-left", "bottom-right", "none"])
    .default("none"),
});

// 3.2 single（置中單圖）
export const SingleConfigSchema = z.object({
  mediaId: mediaIdField,
  width: z.enum(["narrow", "medium", "wide"]).default("medium"),
  caption: LocalizedText.default({ en: "", zh: "" }),
});

// 3.3 pair（雙圖並列）
export const PairConfigSchema = z.object({
  leftMediaId: mediaIdField,
  rightMediaId: mediaIdField,
  ratio: z.enum(["1:1", "2:3", "3:2"]).default("2:3"),
  gap: z.enum(["none", "small", "large"]).default("small"),
  offset: z.boolean().default(false),
});

// 3.4 triptych（三圖橫排）
export const TriptychConfigSchema = z.object({
  mediaIds: mediaIdsField,
  gap: z.enum(["none", "small", "large"]).default("small"),
});

// 3.5 statement（文案區）
export const StatementConfigSchema = z.object({
  textEn: z.string().default(""),
  textZh: z.string().default(""),
  size: z.enum(["small", "medium", "large", "display"]).default("medium"),
  align: z.enum(["left", "center"]).default("center"),
  rhythm: z.enum(["normal", "spacious", "tightening"]).default("normal"),
});

// 3.6 text-image（圖文混排）
export const TextImageConfigSchema = z.object({
  mediaId: mediaIdField,
  textEn: z.string().default(""),
  textZh: z.string().default(""),
  imageSide: z.enum(["left", "right"]).default("left"),
  imageWidth: z.enum(["third", "half", "two-thirds"]).default("half"),
  verticalAlign: z.enum(["top", "center", "bottom"]).default("center"),
});

// 3.7 detail-strip（細節橫向捲動條）
export const DetailStripConfigSchema = z.object({
  mediaIds: mediaIdsField,
  itemHeight: z.enum(["small", "medium", "large"]).default("medium"),
  autoScroll: z.boolean().default(false),
});

// 3.8 sketch-cluster（手繪稿密集排列）
export const SketchClusterConfigSchema = z.object({
  mediaIds: mediaIdsField,
  layout: z.enum(["overlap", "grid", "scatter"]).default("scatter"),
  allowBleed: z.boolean().default(false),
});

// 3.9 spacer（留白）
export const SpacerConfigSchema = z.object({
  size: z.enum(["small", "medium", "large", "xlarge"]).default("medium"),
});

// 3.10 divider（分隔線）
export const DividerConfigSchema = z.object({
  style: z.enum(["hairline", "none"]).default("hairline"),
  label: LocalizedText.default({ en: "", zh: "" }),
});

// 3.11 lens（球形遮罩互動）
export const LensConfigSchema = z.object({
  mediaId: mediaIdField,
  radius: z.enum(["small", "medium", "large"]).default("medium"),
  followCursor: z.boolean().default(true),
});

// 3.12 mirror（鏡像對稱）
export const MirrorConfigSchema = z.object({
  mediaId: mediaIdField,
  axis: z.enum(["horizontal", "vertical"]).default("vertical"),
  gap: z.enum(["none", "hairline"]).default("none"),
});

export const BLOCK_CONFIG_SCHEMAS = {
  "full-bleed": FullBleedConfigSchema,
  single: SingleConfigSchema,
  pair: PairConfigSchema,
  triptych: TriptychConfigSchema,
  statement: StatementConfigSchema,
  "text-image": TextImageConfigSchema,
  "detail-strip": DetailStripConfigSchema,
  "sketch-cluster": SketchClusterConfigSchema,
  spacer: SpacerConfigSchema,
  divider: DividerConfigSchema,
  lens: LensConfigSchema,
  mirror: MirrorConfigSchema,
} as const satisfies Record<BlockType, z.ZodTypeAny>;

/** 讀取既有 config 時用——丟出的錯誤請在呼叫端接住，不要讓整頁崩潰。 */
export function parseBlockConfig(type: BlockType, raw: unknown): unknown {
  return BLOCK_CONFIG_SCHEMAS[type].parse(raw);
}

/** 新增區塊時用——所有欄位都有 default()，parse({}) 一定會成功。 */
export function defaultBlockConfig(type: BlockType): unknown {
  return BLOCK_CONFIG_SCHEMAS[type].parse({});
}
