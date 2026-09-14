"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { requireAuth } from "@/lib/auth/guard";
import {
  BLOCK_CONFIG_SCHEMAS,
  BlockTypeEnum,
  defaultBlockConfig,
  type BlockType,
} from "@/lib/blocks/schemas";
import { buildSnapshot, serializeSnapshot } from "@/lib/blocks/publish";
import { db } from "@/lib/db/client";
import { blocks, collections } from "@/lib/db/schema";
import { adminWriteRateLimit } from "@/lib/rate-limit";

async function checkRateLimit(userId: string): Promise<void> {
  const { success } = await adminWriteRateLimit.limit(userId);
  if (!success) throw new Error("RATE_LIMITED");
}

// ── 新增 ───────────────────────────────────────────────────────────

const CreateBlockSchema = z.object({
  collectionId: z.string().cuid2(),
  type: BlockTypeEnum,
});

export async function createBlock(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await requireAuth();
  try {
    await checkRateLimit(session.user.id);
  } catch {
    return { ok: false, error: "操作太頻繁，請稍後再試。" };
  }

  const parsed = CreateBlockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "輸入格式錯誤" };
  }
  const { collectionId, type } = parsed.data;

  const existing = await db
    .select({ sortOrder: blocks.sortOrder })
    .from(blocks)
    .where(eq(blocks.collectionId, collectionId))
    .orderBy(asc(blocks.sortOrder));
  const nextSortOrder =
    existing.length === 0 ? 1 : Math.max(...existing.map((b) => b.sortOrder)) + 1;

  const id = createId();
  await db.insert(blocks).values({
    id,
    collectionId,
    type,
    config: JSON.stringify(defaultBlockConfig(type)),
    sortOrder: nextSortOrder,
  });

  revalidatePath(`/admin/collections/${collectionId}/blocks`);
  return { ok: true, id };
}

// ── 刪除 ───────────────────────────────────────────────────────────

const DeleteBlockSchema = z.object({
  id: z.string().cuid2(),
  collectionId: z.string().cuid2(),
});

export async function deleteBlock(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth();
  try {
    await checkRateLimit(session.user.id);
  } catch {
    return { ok: false, error: "操作太頻繁，請稍後再試。" };
  }

  const parsed = DeleteBlockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "輸入格式錯誤" };
  }

  await db.delete(blocks).where(eq(blocks.id, parsed.data.id));

  revalidatePath(`/admin/collections/${parsed.data.collectionId}/blocks`);
  return { ok: true };
}

// ── 更新單一區塊的 config（先用通用 JSON 編輯，逐區塊表單留到下一批）──

const UpdateBlockConfigSchema = z.object({
  id: z.string().cuid2(),
  collectionId: z.string().cuid2(),
  config: z.unknown(),
});

export async function updateBlockConfig(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth();
  try {
    await checkRateLimit(session.user.id);
  } catch {
    return { ok: false, error: "操作太頻繁，請稍後再試。" };
  }

  const parsed = UpdateBlockConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "輸入格式錯誤" };
  }
  const { id, collectionId, config } = parsed.data;

  const [row] = await db.select().from(blocks).where(eq(blocks.id, id)).limit(1);
  if (!row) return { ok: false, error: "找不到這個區塊" };

  // SPEC.md §12.5：讀寫都要經過對應 type 的 Zod schema，不可以直接信任
  // 前端傳來的 JSON——就算是後台自己的表單也一樣要驗。
  const schema = BLOCK_CONFIG_SCHEMAS[row.type as BlockType];
  const validated = schema.safeParse(config);
  if (!validated.success) {
    return {
      ok: false,
      error: `config 不符合 ${row.type} 的格式：${validated.error.issues[0]?.message}`,
    };
  }

  await db
    .update(blocks)
    .set({ config: JSON.stringify(validated.data), updatedAt: new Date() })
    .where(eq(blocks.id, id));

  revalidatePath(`/admin/collections/${collectionId}/blocks`);
  return { ok: true };
}

// ── 拖曳排序 ───────────────────────────────────────────────────────

const ReorderBlocksSchema = z.object({
  collectionId: z.string().cuid2(),
  orderedIds: z.array(z.string().cuid2()).min(1),
});

export async function reorderBlocks(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth();
  try {
    await checkRateLimit(session.user.id);
  } catch {
    return { ok: false, error: "操作太頻繁，請稍後再試。" };
  }

  const parsed = ReorderBlocksSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "輸入格式錯誤" };
  }
  const { collectionId, orderedIds } = parsed.data;

  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(blocks)
        .set({ sortOrder: index + 1, updatedAt: new Date() })
        .where(eq(blocks.id, id)),
    ),
  );

  revalidatePath(`/admin/collections/${collectionId}/blocks`);
  return { ok: true };
}

// ── 發布（SPEC.md §13 項目 20）───────────────────────────────────────
// 把當下這個系列的 blocks 序列化整包寫進 collections.publishedSnapshot。
// blocks 表本身不動——這個動作是唯一會寫入「正式版」的地方。

const PublishCollectionSchema = z.object({
  collectionId: z.string().cuid2(),
});

export async function publishCollection(
  input: unknown,
): Promise<{ ok: true; publishedAt: Date } | { ok: false; error: string }> {
  const session = await requireAuth();
  try {
    await checkRateLimit(session.user.id);
  } catch {
    return { ok: false, error: "操作太頻繁，請稍後再試。" };
  }

  const parsed = PublishCollectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "輸入格式錯誤" };
  }
  const { collectionId } = parsed.data;

  const rows = await db
    .select()
    .from(blocks)
    .where(eq(blocks.collectionId, collectionId))
    .orderBy(asc(blocks.sortOrder));

  let snapshotText: string;
  try {
    snapshotText = serializeSnapshot(buildSnapshot(rows));
  } catch {
    // 理論上不該發生——每筆 config 寫入時就驗證過了——但發布是會實際影響
    // 「正式版」的動作，寧可在這裡多一層防呆也不要讓壞資料被發布出去。
    return { ok: false, error: "有區塊的內容格式不正確，無法發布，請檢查各區塊表單。" };
  }

  const publishedAt = new Date();
  const [updated] = await db
    .update(collections)
    .set({ publishedSnapshot: snapshotText, publishedAt })
    .where(eq(collections.id, collectionId))
    .returning({ slug: collections.slug });

  revalidatePath(`/admin/collections/${collectionId}/blocks`);
  // 發布是唯一會改變「/work/[slug] 有沒有東西可以顯示」的動作——SPEC §8.2
  // 的 sitemap、llms.txt 都靠同一條「public + 已發布」判斷式，這幾個公開
  // 路徑不重新驗證的話，production（Vercel 的靜態快取）會在發布後繼續
  // 顯示發布前的舊結果，直到下次部署才會自然更新（這批 SEO 收尾實測
  // `pnpm build && pnpm start` 才抓到——`next dev` 不會套用這層快取，
  // 之前的批次都只在 dev 模式測過，沒有踩到）。
  if (updated) {
    revalidatePath(`/work/${updated.slug}`);
    revalidatePath("/");
    revalidatePath("/sitemap.xml");
    revalidatePath("/llms.txt");
  }
  return { ok: true, publishedAt };
}
