/**
 * SPEC.md §11.4 — 內容 seed。跑在 `ingest-assets.ts --apply` 之後（需要
 * 真實 media 列才能填 blocks 的 mediaId）。可重複執行：collections /
 * awards 用 upsert（awards 以 sortOrder 當穩定 key），blocks / profile
 * 若偵測到已有資料則跳過並警告，不會重複塞資料。
 *
 * 用法：pnpm tsx scripts/seed-content.ts
 *
 * 三個系列的 year / category / pieceCount 業主尚未提供（SPEC.md §10.3），
 * 本次全部留白（null），前台需能處理缺值。
 */
import { and, asc, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { createDb } from "../src/lib/db/create-client";
import { awards, blocks, collections, media, profile } from "../src/lib/db/schema";

const db = createDb({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

type MediaKind = "final" | "detail" | "sketch" | "poster" | "process" | "misc";

// ── 小工具：從某系列＋kind 的媒材池依序取用，池用完就循環 ──────────

async function mediaPool(collectionId: string, kind: MediaKind) {
  const rows = await db
    .select({ id: media.id, filename: media.filename })
    .from(media)
    .where(and(eq(media.collectionId, collectionId), eq(media.kind, kind)))
    .orderBy(asc(media.sortOrder));
  let cursor = 0;
  return {
    rows,
    take(n: number): string[] {
      if (rows.length === 0) return [];
      const picked: string[] = [];
      for (let i = 0; i < n; i++) {
        picked.push(rows[cursor % rows.length].id);
        cursor++;
      }
      return picked;
    },
    one(): string {
      return this.take(1)[0];
    },
  };
}

async function mediaByFilename(filename: string): Promise<string> {
  const rows = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.filename, filename))
    .limit(1);
  if (!rows[0]) throw new Error(`找不到 filename = ${filename} 的 media 列`);
  return rows[0].id;
}

async function getCollectionId(slug: string): Promise<string> {
  const rows = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);
  if (!rows[0]) {
    throw new Error(
      `找不到 slug = ${slug} 的 collections 列，請先跑過 ingest-assets.ts --apply`,
    );
  }
  return rows[0].id;
}

// ── 1. collections — 內容取自 SPEC.md §10.1 ──────────────────────────

async function seedCollections() {
  console.log("\n=== 1. collections ===");

  await db
    .update(collections)
    .set({
      titleZh: "未完待酗",
      theme: "dark",
      accentNote:
        "主色：紅（口紅、絲襪、帽子、保險套包裝、T恤印字）× 銀（金蔥流蘇）；" +
        "攝影語言：直打閃燈、硬陰影、廁所磁磚、鏡面反射",
      statementZh:
        "散落的高跟鞋、凌亂的內衣、空了的酒瓶，霓虹燈照著一夜未散的餘溫。\n" +
        "空氣裡瀰漫著酒精、香水與濃烈的情慾，每一件遺落的物品，都像是昨夜放縱後留下的證據。",
      statementEn:
        "Scattered heels, discarded lingerie, and empty bottles remain beneath the neon glow.\n" +
        "The air is heavy with liquor, perfume, and lingering desire.\n" +
        "Every forgotten object feels like silent evidence of a night consumed by temptation.",
      visibility: "draft",
      requiresConsent: true,
      // 草稿文字，SPEC.md 未提供逐字內容，待業主確認 — SPEC.md §10.1「含裸露、菸、酒」
      consentNoteZh: "此系列作品含裸露、菸酒等內容，僅適合成年觀眾瀏覽。",
      consentNoteEn:
        "This collection contains nudity, smoking, and alcohol, and is intended for mature audiences only.",
      updatedAt: new Date(),
    })
    .where(eq(collections.slug, "cumedy-night"));
  console.log("  cumedy-night 已更新");

  await db
    .update(collections)
    .set({
      titleZh: "在最後的淨土上孤獨",
      theme: "light",
      accentNote:
        "主色：近白、淺灰藍（高調攝影，幾乎無彩度）；" +
        "攝影語言：無縫淺灰藍背景、柔光、大量留白、機能布料抽褶與 mesh 網布",
      statementZh:
        "這是哪裡⋯為何世界如此寂靜..\n" +
        "我不疾不徐的呼吸著空氣試圖掩蓋自己的不安\n" +
        "這可能就是未來吧。即使到了未來我還是一樣孤獨的活著\n" +
        "唯一不同的是我感受著無人的風滑過臉頰，腳踩著無垢的白沙，與這片淨土合而為一。\n" +
        "這片土地還有人嗎？我該尋找剩下的人類嗎？\n" +
        "⋯⋯不曉得 我沈靜在一個人的世界，呼吸著寧靜與祥和\n" +
        "守護著我溫柔的孤獨",
      statementEn:
        "Where is this... Why is the world so silent?\n" +
        "I breathe steadily, trying to mask my unease.\n" +
        "This must be the future. Even in the future, I live in the same solitude.\n" +
        "The only difference now is feeling the unmanned wind brush against my cheek,\n" +
        "my feet sinking into the pure white sand, becoming one with this untouched land.\n" +
        "Is there anyone left on this earth? Should I seek out the remaining humans?\n" +
        "… I don't know. I find peace in this solitary world, breathing in the stillness and serenity.\n" +
        "Guarding my gentle loneliness.",
      visibility: "draft",
      requiresConsent: false,
      updatedAt: new Date(),
    })
    .where(eq(collections.slug, "pure-land"));
  console.log("  pure-land 已更新（換行以 \\n 保留，前台需以 white-space: pre-line 渲染）");

  await db
    .update(collections)
    .set({
      titleZh: "X-venom",
      theme: "void",
      accentNote:
        "主色：卡其軍綠 × 鏽紅 × 噴漆黑；攝影語言：低角度、側逆光、深藍灰背景、戲劇性陰影",
      statementZh:
        "隨著視線模糊，刺痛伴隨著血液流動蔓延到全身\n" +
        "身體開始劇烈變化，長出了尖刺，身體的中毒反應，使得身上出現了斑點\n" +
        "面對強大的毒素神經系統宣告戰敗\n" +
        "取而代之的是疾病支配著這具殘破的空殼",
      statementEn:
        "As my vision blurred, the stinging sensation spread throughout my body, carried by the flow of blood.\n" +
        "My body began to undergo violent changes, sprouting spikes as the poison coursing through me caused spots to appear on my skin.\n" +
        "Faced with the overwhelming toxin, my nervous system finally surrendered.\n" +
        "In its place, the disease took control, dominating this broken, hollow shell.",
      visibility: "draft",
      requiresConsent: false,
      updatedAt: new Date(),
    })
    .where(eq(collections.slug, "x-venom"));
  console.log("  x-venom 已更新");

  // coverImageId — 各系列第一張 final（僅供後台預覽用的合理起始值）
  for (const slug of ["cumedy-night", "pure-land", "x-venom"] as const) {
    const collectionId = await getCollectionId(slug);
    const finals = await mediaPool(collectionId, "final");
    if (finals.rows[0]) {
      await db
        .update(collections)
        .set({ coverImageId: finals.rows[0].id })
        .where(eq(collections.id, collectionId));
    }
  }
  console.log(
    "  coverImageId 已設為各系列第一張 final（暫定值，可在後台改選）",
  );
  console.log(
    "  ⚠️ ogImageId 刻意留空未填 — SPEC.md §7.5 明文要求獨立指定、不可自動取用，" +
      "cumedy-night 含裸露內容更不能亂選，需要業主/設計師在後台手動指定",
  );
}

// ── 2. awards — 內容取自 SPEC.md §2.6（含 §14.4 對談後的更正）────────

// 官方英文譯名（校名、系所、賽事名）需業主/機構提供，寧可留 null 也不要放
// 草擬翻譯冒充正式譯名——與業主對話後的明確決定。resultZh/resultEn 同理：
// 證書上沒有名次文字，「金點新秀」是獎項名稱本身，不是名次，實際是入選
// 還是得獎需另外向業主確認。
const AWARD_SEEDS: {
  sortOrder: number;
  year: string;
  titleZh: string;
  titleEn: string | null;
  resultZh: string | null;
  resultEn: string | null;
}[] = [
  {
    sortOrder: 1,
    year: "2023",
    titleZh: "嶺東科技大學服飾設計系時裝週",
    titleEn: null,
    resultZh: "第一名",
    resultEn: "First Place",
  },
  {
    sortOrder: 2,
    year: "2025",
    titleZh: "嶺東科技大學服飾設計系第七屆畢業展",
    titleEn: null,
    resultZh: "第三名",
    resultEn: "Third Place",
  },
  {
    sortOrder: 3,
    year: "2026",
    // 證書上的正式全名，不可簡寫成「金點新秀」——「金點設計獎」與
    // 「金點新秀設計獎」是兩個不同的獎，簡稱容易混淆
    titleZh: "金點新秀設計獎",
    // 證書英文名為 "Young Pin Design Award"（見證書圖檔），非草擬
    titleEn: "Young Pin Design Award",
    resultZh: null,
    resultEn: null,
  },
  {
    sortOrder: 4,
    year: "2026",
    titleZh: "武漢長江盃",
    titleEn: null,
    resultZh: "優勝",
    resultEn: "Winner",
  },
];

async function seedAwards() {
  console.log("\n=== 2. awards ===");

  for (const seed of AWARD_SEEDS) {
    const existing = await db
      .select({ id: awards.id })
      .from(awards)
      .where(eq(awards.sortOrder, seed.sortOrder))
      .limit(1);

    if (existing[0]) {
      await db
        .update(awards)
        .set({
          year: seed.year,
          titleZh: seed.titleZh,
          titleEn: seed.titleEn,
          resultZh: seed.resultZh,
          resultEn: seed.resultEn,
        })
        .where(eq(awards.id, existing[0].id));
      console.log(`  sortOrder ${seed.sortOrder}（${seed.titleZh}）已更新`);
    } else {
      await db.insert(awards).values({
        id: createId(),
        // 證書圖片走後台一般上傳流程關聯 imageId，尚未上傳，先留空
        imageId: null,
        ...seed,
      });
      console.log(`  sortOrder ${seed.sortOrder}（${seed.titleZh}）已建立`);
    }
  }
}

// ── 3. profile — SPEC.md §11.4 step 3，未提供欄位留空 ─────────────────

async function seedProfile() {
  console.log("\n=== 3. profile ===");
  const existing = await db
    .select({ id: profile.id })
    .from(profile)
    .where(eq(profile.id, "singleton"))
    .limit(1);
  if (existing.length > 0) {
    console.log("  profile 已有資料，略過（避免覆蓋既有編輯）");
    return;
  }

  await db.insert(profile).values({
    id: "singleton",
    nameZh: "曾昱睿",
    nameEn: "Tseng Yu Jui",
    roleZh: "服裝設計師",
    roleEn: "Fashion Designer",
    // bio / 聯絡方式 / Instagram / Behance — SPEC.md §10.3 尚待業主提供
    updatedAt: new Date(),
  });
  console.log("  已建立 profile 單筆紀錄（bio、聯絡方式等留空待補）");
}

// ── 4. blocks — 初始配置，依 SPEC.md §5.4 / §11.4 排版體感 ────────────

async function seedBlocksForCollection(slug: string) {
  const existing = await db
    .select({ id: blocks.id })
    .from(blocks)
    .innerJoin(collections, eq(blocks.collectionId, collections.id))
    .where(eq(collections.slug, slug))
    .limit(1);
  if (existing.length > 0) {
    console.log(`  ${slug} 已有 blocks，略過`);
    return;
  }

  const collectionId = await getCollectionId(slug);
  const rows: { type: string; config: object }[] = [];

  if (slug === "cumedy-night") {
    const final = await mediaPool(collectionId, "final");
    rows.push(
      {
        type: "full-bleed",
        config: {
          mediaId: final.one(),
          height: "screen",
          overlayText: { en: "", zh: "" },
          overlayPosition: "none",
        },
      },
      {
        type: "statement",
        config: {
          textEn:
            "Scattered heels, discarded lingerie, and empty bottles remain beneath the neon glow.\n" +
            "The air is heavy with liquor, perfume, and lingering desire.\n" +
            "Every forgotten object feels like silent evidence of a night consumed by temptation.",
          textZh:
            "散落的高跟鞋、凌亂的內衣、空了的酒瓶，霓虹燈照著一夜未散的餘溫。\n" +
            "空氣裡瀰漫著酒精、香水與濃烈的情慾，每一件遺落的物品，都像是昨夜放縱後留下的證據。",
          size: "medium",
          align: "center",
          rhythm: "normal",
        },
      },
      {
        type: "pair",
        config: (() => {
          const [l, r] = final.take(2);
          return { leftMediaId: l, rightMediaId: r, ratio: "2:3", gap: "small", offset: true };
        })(),
      },
      { type: "mirror", config: { mediaId: final.one(), axis: "vertical", gap: "none" } },
      {
        type: "pair",
        config: (() => {
          const [l, r] = final.take(2);
          return { leftMediaId: l, rightMediaId: r, ratio: "2:3", gap: "small", offset: true };
        })(),
      },
      {
        type: "detail-strip",
        config: { mediaIds: final.take(4), itemHeight: "medium", autoScroll: false },
      },
      {
        // 收尾文案 SPEC.md 未提供第二段文字，留空待設計師填入
        type: "statement",
        config: { textEn: "", textZh: "", size: "small", align: "center", rhythm: "normal" },
      },
      { type: "triptych", config: { mediaIds: final.take(3), gap: "small" } },
    );
  }

  if (slug === "pure-land") {
    const final = await mediaPool(collectionId, "final");
    const sketch = await mediaPool(collectionId, "sketch");
    // SPEC.md §10.1「Hero 首選」明確指定原檔 IMG_1820
    const heroId = await mediaByFilename("IMG_1820.jpeg");

    rows.push(
      {
        type: "full-bleed",
        config: { mediaId: heroId, height: "screen", overlayText: { en: "", zh: "" }, overlayPosition: "none" },
      },
      { type: "spacer", config: { size: "xlarge" } },
      { type: "single", config: { mediaId: final.one(), width: "narrow", caption: { en: "", zh: "" } } },
      { type: "spacer", config: { size: "xlarge" } },
      {
        type: "statement",
        config: {
          textEn:
            "Where is this... Why is the world so silent?\n" +
            "I breathe steadily, trying to mask my unease.\n" +
            "This must be the future. Even in the future, I live in the same solitude.\n" +
            "The only difference now is feeling the unmanned wind brush against my cheek,\n" +
            "my feet sinking into the pure white sand, becoming one with this untouched land.\n" +
            "Is there anyone left on this earth? Should I seek out the remaining humans?\n" +
            "… I don't know. I find peace in this solitary world, breathing in the stillness and serenity.\n" +
            "Guarding my gentle loneliness.",
          textZh:
            "這是哪裡⋯為何世界如此寂靜..\n" +
            "我不疾不徐的呼吸著空氣試圖掩蓋自己的不安\n" +
            "這可能就是未來吧。即使到了未來我還是一樣孤獨的活著\n" +
            "唯一不同的是我感受著無人的風滑過臉頰，腳踩著無垢的白沙，與這片淨土合而為一。\n" +
            "這片土地還有人嗎？我該尋找剩下的人類嗎？\n" +
            "⋯⋯不曉得 我沈靜在一個人的世界，呼吸著寧靜與祥和\n" +
            "守護著我溫柔的孤獨",
          size: "large",
          align: "center",
          rhythm: "spacious",
        },
      },
      { type: "spacer", config: { size: "xlarge" } },
      { type: "single", config: { mediaId: final.one(), width: "narrow", caption: { en: "", zh: "" } } },
      { type: "spacer", config: { size: "large" } },
      {
        type: "sketch-cluster",
        config: { mediaIds: sketch.take(sketch.rows.length), layout: "scatter", allowBleed: false },
      },
      { type: "single", config: { mediaId: final.one(), width: "narrow", caption: { en: "", zh: "" } } },
    );
  }

  if (slug === "x-venom") {
    const final = await mediaPool(collectionId, "final");
    const detail = await mediaPool(collectionId, "detail");
    // SPEC.md §10.1「此海報即為該系列現成的視覺系統，開場區塊直接使用它」
    // 實際檔名經目視核對是 IMG_0867（有字版，見與業主的對話紀錄）
    const posterId = await mediaByFilename("IMG_0867.jpeg");

    rows.push(
      {
        type: "full-bleed",
        config: { mediaId: posterId, height: "screen", overlayText: { en: "", zh: "" }, overlayPosition: "none" },
      },
      {
        type: "statement",
        config: {
          textEn:
            "As my vision blurred, the stinging sensation spread throughout my body, carried by the flow of blood.\n" +
            "My body began to undergo violent changes, sprouting spikes as the poison coursing through me caused spots to appear on my skin.\n" +
            "Faced with the overwhelming toxin, my nervous system finally surrendered.\n" +
            "In its place, the disease took control, dominating this broken, hollow shell.",
          textZh:
            "隨著視線模糊，刺痛伴隨著血液流動蔓延到全身\n" +
            "身體開始劇烈變化，長出了尖刺，身體的中毒反應，使得身上出現了斑點\n" +
            "面對強大的毒素神經系統宣告戰敗\n" +
            "取而代之的是疾病支配著這具殘破的空殼",
          size: "medium",
          align: "center",
          rhythm: "tightening",
        },
      },
      { type: "lens", config: { mediaId: final.one(), radius: "medium", followCursor: true } },
      {
        type: "pair",
        config: (() => {
          const [l, r] = final.take(2);
          return { leftMediaId: l, rightMediaId: r, ratio: "2:3", gap: "small", offset: false };
        })(),
      },
      {
        type: "detail-strip",
        config: { mediaIds: detail.take(detail.rows.length), itemHeight: "medium", autoScroll: false },
      },
      {
        type: "statement",
        config: { textEn: "", textZh: "", size: "small", align: "center", rhythm: "tightening" },
      },
      // 注意：SPEC.md 範本在這裡本來排了 sketch-cluster，但 x-venom 目前
      // 沒有任何手繪稿素材（已於匯入階段確認），刻意省略這個空區塊
      { type: "single", config: { mediaId: final.one(), width: "medium", caption: { en: "", zh: "" } } },
    );
  }

  await db.insert(blocks).values(
    rows.map((r, i) => ({
      id: createId(),
      collectionId,
      type: r.type,
      config: JSON.stringify(r.config),
      sortOrder: i + 1,
    })),
  );
  console.log(`  ${slug} 已建立 ${rows.length} 個 blocks`);
}

async function seedBlocks() {
  console.log("\n=== 4. blocks ===");
  for (const slug of ["cumedy-night", "pure-land", "x-venom"]) {
    await seedBlocksForCollection(slug);
  }
}

async function main() {
  await seedCollections();
  await seedAwards();
  await seedProfile();
  await seedBlocks();
  console.log("\n✓ seed 完成");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
