import { z } from "zod";
import { BLOCK_CONFIG_SCHEMAS, BlockTypeEnum, type BlockType } from "./schemas";

/**
 * SPEC.md §13 項目 20（草稿/發布）— 系列層級快照。
 *
 * 資料模型：`collections.publishedSnapshot`（JSON 字串）+ `publishedAt`。
 * `blocks` 表與所有既有的 block CRUD server action 完全不動——正常編輯
 * 就是草稿，「發布」是把當下整頁 blocks 序列化寫進 `publishedSnapshot`
 * 的獨立動作（見 `../../app/admin/collections/[id]/blocks/actions.ts`
 * 的 `publishCollection`）。
 *
 * 這個檔案處理「怎麼把 blocks 轉成快照」「草稿跟快照是否不同」，以及
 * 前台（`/work/[slug]`）讀快照時的驗證（`parsePublishedSnapshot`）。
 */

export const PublishedBlockSchema = z.object({
  id: z.string().cuid2(),
  type: BlockTypeEnum,
  sortOrder: z.number().int(),
  config: z.unknown(),
});

export const PublishedSnapshotSchema = z.array(PublishedBlockSchema);

export type PublishedSnapshot = z.infer<typeof PublishedSnapshotSchema>;

interface BlockLike {
  id: string;
  type: string;
  sortOrder: number;
  config: string;
}

/**
 * 把資料庫查出來的 blocks 轉成快照要存的正規化陣列。每筆的 config 都重新
 * 過一次該 type 對應的 Zod schema——SPEC §12.5 要求讀寫 blocks.config 都
 * 要驗證，不可以直接信任查出來的 JSON 字串，就算是自己系統寫進去的也一樣。
 *
 * 之所以能用 JSON.stringify 之後的字串判斷「有沒有變」（見
 * `hasUnpublishedChanges`），是因為 Zod 的 object schema 每次 parse 都會
 * 依 schema 宣告順序重建輸出物件的 key 順序，不管輸入的 key 順序是什麼；
 * 只要草稿端跟快照端都固定經過同一個 schema、同一個函式，序列化出來的
 * 字串才具備可比較性。
 */
export function buildSnapshot(rows: BlockLike[]): PublishedSnapshot {
  return rows
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => ({
      id: row.id,
      type: row.type as BlockType,
      sortOrder: row.sortOrder,
      config: BLOCK_CONFIG_SCHEMAS[row.type as BlockType].parse(JSON.parse(row.config)),
    }));
}

export function serializeSnapshot(snapshot: PublishedSnapshot): string {
  return JSON.stringify(snapshot);
}

/**
 * 目前草稿 blocks 序列化後，是否跟資料庫裡 `publishedSnapshot` 存的字串
 * 不同。`publishedSnapshot` 為 `null`（從沒發布過）且草稿也沒有任何區塊時
 * 視為「沒有變更」——空系列沒有東西好發布，不用提示「請發布」。
 */
export function hasUnpublishedChanges(
  draftRows: BlockLike[],
  publishedSnapshot: string | null,
): boolean {
  if (publishedSnapshot === null) {
    return draftRows.length > 0;
  }
  return serializeSnapshot(buildSnapshot(draftRows)) !== publishedSnapshot;
}

/**
 * 前台（`/work/[slug]`）讀 `collections.publishedSnapshot` 時用——先過
 * 陣列形狀的 `PublishedSnapshotSchema`，再逐筆用該 type 對應的
 * `BLOCK_CONFIG_SCHEMAS` 重新驗證 `config`，不直接信任存進去的字串
 * （SPEC §12.5：即使是自己系統寫的也要驗證）。丟出的錯誤請在呼叫端接住，
 * 不要讓整頁崩潰。
 */
export function parsePublishedSnapshot(raw: string): PublishedSnapshot {
  const parsed = PublishedSnapshotSchema.parse(JSON.parse(raw));
  return parsed
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((block) => ({
      ...block,
      config: BLOCK_CONFIG_SCHEMAS[block.type].parse(block.config),
    }));
}

/**
 * 列出快照裡每個區塊實際用到的 media id——`/work/[slug]` 用這支決定
 * 「這頁真的需要查哪幾筆 media」，不要整張 `media` 表撈出來（SEO 批次
 * 全專案排查抓到的既有缺口：撈全站 media 等於把其他系列——含草稿——的
 * `r2Key`/`filename` 也一起帶出來，即使實測沒觀察到經由 RSC payload
 * 外洩，公開路由也沒理由查超出畫面會用到的資料）。
 *
 * 12 種區塊 schema（`src/lib/blocks/schemas.ts`）只用 4 種欄位名稱存
 * media 參照：`mediaId`（單張，可 null）、`leftMediaId`/`rightMediaId`
 * （`pair`）、`mediaIds`（陣列）。這裡用鴨子型別逐一檢查，不依賴每種
 * block type 各自的 TS 型別（`config` 經過 Zod 驗證後仍是寬鬆型別）。
 */
export function extractMediaIds(snapshot: PublishedSnapshot): string[] {
  const ids = new Set<string>();
  for (const block of snapshot) {
    const config = block.config;
    if (typeof config !== "object" || config === null) continue;
    const c = config as Record<string, unknown>;
    if (typeof c.mediaId === "string") ids.add(c.mediaId);
    if (typeof c.leftMediaId === "string") ids.add(c.leftMediaId);
    if (typeof c.rightMediaId === "string") ids.add(c.rightMediaId);
    if (Array.isArray(c.mediaIds)) {
      for (const id of c.mediaIds) {
        if (typeof id === "string") ids.add(id);
      }
    }
  }
  return Array.from(ids);
}
