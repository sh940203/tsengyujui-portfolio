import { createId } from "@paralleldrive/cuid2";
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ─────────────────────────────────────────────────────────
// Auth.js required tables (Drizzle adapter, SQLite/Turso)
// ─────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "timestamp_ms" }),
  image: text("image"),
  role: text("role", { enum: ["owner", "admin"] }).notNull().default("owner"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ─────────────────────────────────────────────────────────
// Domain tables — SPEC.md §2
// ─────────────────────────────────────────────────────────

export const media = sqliteTable("media", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  r2Key: text("r2_key").notNull(),
  filename: text("filename"),
  mimeType: text("mime_type"),
  width: integer("width"),
  height: integer("height"),
  fileSize: integer("file_size"),

  rotation: integer("rotation").notNull().default(0),
  focalX: real("focal_x").notNull().default(0.5),
  focalY: real("focal_y").notNull().default(0.5),

  altEn: text("alt_en"),
  altZh: text("alt_zh"),
  caption: text("caption"),

  collectionId: text("collection_id").references(
    (): AnySQLiteColumn => collections.id,
    { onDelete: "set null" },
  ),
  kind: text("kind", {
    enum: ["final", "detail", "sketch", "poster", "process", "misc"],
  })
    .notNull()
    .default("misc"),

  sortOrder: integer("sort_order").notNull().default(0),

  // 首頁輪播的精選照——null 代表這張圖不是精選照；非 null 時是它在「這個
  // 系列自己的精選清單」裡的順序（0-based，同一系列內遞增，不同系列各自
  // 獨立編號，不是全站共用一個排序空間）。選了「media 加欄位」而不是另建
  // 對應表：一個欄位就能同時表達「有沒有被選」跟「順序」，不用多一張表、
  // 多一次 join。見 src/lib/media/featured.ts。
  featuredOrder: integer("featured_order"),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const collections = sqliteTable("collections", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  slug: text("slug").notNull().unique(),
  titleEn: text("title_en").notNull(),
  titleZh: text("title_zh"),
  year: text("year"),
  category: text("category"),
  pieceCount: integer("piece_count"),

  statementEn: text("statement_en"),
  statementZh: text("statement_zh"),

  theme: text("theme", { enum: ["dark", "light", "void"] })
    .notNull()
    .default("dark"),
  accentNote: text("accent_note"),

  coverImageId: text("cover_image_id").references(() => media.id),
  ogImageId: text("og_image_id").references(() => media.id),
  titleImageId: text("title_image_id").references(() => media.id),

  visibility: text("visibility", { enum: ["public", "unlisted", "draft"] })
    .notNull()
    .default("draft"),
  requiresConsent: integer("requires_consent", { mode: "boolean" })
    .notNull()
    .default(false),
  consentNoteEn: text("consent_note_en"),
  consentNoteZh: text("consent_note_zh"),

  // SPEC.md §13 項目 20（草稿/發布）——系列層級快照：null 代表這個系列從
  // 沒發布過。「發布」動作把當下 blocks 序列化整包寫進這裡，blocks 表本身
  // 不分草稿/正式兩種狀態，正常編輯即視為草稿。見 src/lib/blocks/publish.ts。
  publishedSnapshot: text("published_snapshot"),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),

  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// blocks.config is stored as a JSON string (see SPEC.md §12.5 — parse
// through the matching Zod schema for the block's `type`, never trust
// JSON.parse() output directly).
export const blocks = sqliteTable("blocks", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  collectionId: text("collection_id")
    .notNull()
    .references(() => collections.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  config: text("config").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const profile = sqliteTable("profile", {
  id: text("id").primaryKey().default("singleton"),

  nameEn: text("name_en"),
  nameZh: text("name_zh"),
  roleEn: text("role_en"),
  roleZh: text("role_zh"),
  locationEn: text("location_en"),
  locationZh: text("location_zh"),

  bioEn: text("bio_en"),
  bioZh: text("bio_zh"),

  email: text("email"),
  instagram: text("instagram"),
  behance: text("behance"),

  heroImageId: text("hero_image_id").references(() => media.id),
  aboutImageId: text("about_image_id").references(() => media.id),

  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  defaultOgImageId: text("default_og_image_id").references(() => media.id),

  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const awards = sqliteTable("awards", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  year: text("year").notNull(),
  // 官方英文譯名常需業主/機構提供，未取得前留 null，不放草擬翻譯
  // （見與業主對話：寧可留白也不要放錯誤翻譯）
  titleEn: text("title_en"),
  titleZh: text("title_zh"),
  resultEn: text("result_en"),
  resultZh: text("result_zh"),
  imageId: text("image_id").references(() => media.id, { onDelete: "set null" }),
  // 是否在關於頁公開展示這筆獎項的證書圖片——業主尚未決定（SPEC.md
  // §10.4），刻意跟「有沒有上傳 imageId」分開成獨立欄位：後台可能先把
  // 證書存進來備查，不代表業主已經同意公開展示，兩件事不能綁在一起用
  // 「有沒有圖」反推「該不該顯示」。預設 false，不預設顯示。
  showCertificate: integer("show_certificate", { mode: "boolean" })
    .notNull()
    .default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});
