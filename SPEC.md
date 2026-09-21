# 曾昱睿 Tseng Yu Jui — 服裝設計作品集官網

**建置規格書 v1.0**

本文件為完整開發規格。閱讀後請先確認「開發順序」章節，依階段實作。

---

## 0. 專案概述

### 0.1 目標

為服裝設計師曾昱睿（Tseng Yu Jui）建置個人作品集官網，包含：

- **前台**：展示三個服裝系列、個人簡介、比賽經歷、聯絡方式
- **後台**：完整內容管理系統，設計師本人可自由編輯前台所有展示內容

### 0.2 使用者

| 角色 | 對象 | 權限 |
|---|---|---|
| `owner` | 曾昱睿（設計師本人） | 內容編輯、圖片管理、排序、公開設定 |
| `admin` | 開發者 | 全部權限 + 區塊模板管理、全站設定、SEO |

### 0.3 核心設計原則

1. **作品優先於介面** — 導航與 UI 元素極小、極輕，照片與文字是主角
2. **每個系列有自己的視覺體感** — 骨架相同，但底色、節奏、排版密度各異
3. **英文為主、中文為輔** — 兩種語言永遠同時存在，語言切換改變的是視覺層級而非內容顯隱
4. **後台採區塊拼裝（Block Editor）** — 設計師以預製區塊自由組合每個系列的頁面

---

## 1. 技術架構

### 1.1 技術棧

```
前端框架    Next.js 15 (App Router) + TypeScript
樣式        Tailwind CSS
動效        Framer Motion（節制使用）
資料庫      Turso (LibSQL) + Drizzle ORM
圖片儲存    Cloudflare R2（私有 bucket，透過 signed URL 或自訂 proxy 存取）
圖片處理    匯入時以 sharp 預生成多尺寸（見 1.3）
認證        Auth.js (NextAuth v5) — Email Magic Link
驗證        Zod（所有外部輸入）
速率限制    Upstash Redis + @upstash/ratelimit
部署        Vercel
```

**部署選擇說明**

選 Vercel 而非 Cloudflare Workers / Pages，原因是本專案大量依賴 Node.js runtime 特性：
Auth.js 的 database session、nodemailer 寄信、sharp 影像處理、Server Actions。
這些在 Vercel 上是成熟路徑；在 edge runtime 上需額外處理相容性，會拖慢 Phase 1。

R2 仍作為圖片儲存（無 egress 費用，對高解析作品集是實質成本優勢）。
儲存與運算分離，日後若要遷移部署平台不受影響。

### 1.2 環境變數

```env
# ── Site ──────────────────────────────────────────
NEXT_PUBLIC_SITE_URL=          # 開發期為 *.vercel.app，日後換正式網域只改這裡

# ── Turso ─────────────────────────────────────────
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# ── Cloudflare R2 ─────────────────────────────────
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=                # 公開讀取，僅存放 400/800/1600/2400 的 WebP 變體
R2_ORIGINALS_BUCKET_NAME=      # 私有 bucket，僅存放 original.*（見 §12.4 方案 A）
NEXT_PUBLIC_R2_PUBLIC_URL=     # 僅公開讀取用的網址（對應 R2_BUCKET_NAME）

# ── Auth ──────────────────────────────────────────
AUTH_SECRET=                   # openssl rand -base64 32 — Production/Preview/
                                # Development 三個 Vercel 環境務必各自產生獨立
                                # 一組，不可共用同一組，更不可沿用本機開發用的值
AUTH_URL=                      # 本機開發可用 http://localhost:<port>；
                                # 部署後必須改成正式網域，否則 Auth.js 會擋掉
                                # 請求（UntrustedHost）
EMAIL_SERVER=                  # SMTP 連線字串
EMAIL_FROM=
ALLOWED_LOGIN_EMAILS=          # 逗號分隔的白名單，見 13.2

# ── Rate limiting ─────────────────────────────────
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

**環境變數規則**

- 只有真正需要在瀏覽器讀取的值才加 `NEXT_PUBLIC_` 前綴。
  R2 的 access key、secret、auth token、SMTP 憑證**絕對不可**加此前綴。
- `.env.local` 必須在 `.gitignore` 內。專案需提供 `.env.example`，只列出鍵名不含值。
- Vercel 上的環境變數依環境分離設定：Production / Preview / Development 各一組。
  Preview 環境應使用**獨立的 Turso database 與 R2 bucket**，避免測試資料污染正式內容。
- 所有對外 URL（OG image、sitemap、canonical）一律由 `NEXT_PUBLIC_SITE_URL` 組出，
  **禁止硬編碼網域**。

### 1.3 圖片處理策略

原檔為 Capture One 輸出，約 3712×5568，單檔數 MB。**不得直接提供給瀏覽器**。

採「**匯入時預生成多尺寸**」策略，而非請求時即時轉檔。

**理由**：作品集的圖片是固定、幾乎不變動的資產，沒有即時轉檔的必要；
且即時轉檔（Cloudflare Image Resizing）需要自有網域掛在 Cloudflare 上，
本專案初期無網域，該路徑不可用。預生成方案與部署平台、網域狀態完全解耦。

**產出規格**

匯入腳本以 `sharp` 為每張原圖生成下列變體，全部存入 R2：

```
{slug}/{kind}/{cuid}/400.webp      後台縮圖、列表
{slug}/{kind}/{cuid}/800.webp      手機內文
{slug}/{kind}/{cuid}/1600.webp     桌機內文
{slug}/{kind}/{cuid}/2400.webp     滿版 Hero
{slug}/{kind}/{cuid}/original.jpg  保留原檔（僅後台可取用）
```

- 格式：WebP，`quality: 82`
- 若原圖寬度小於目標尺寸，**不放大畫素**，但該尺寸的檔案**仍要生成**（存原始尺寸那份）——`next/image` 的載入器只會挑「大於等於需求寬度的下一檔」，少了任何一檔，高解析度大螢幕就會去要不存在的檔案而 404（2026-09-21 Cumedy 手繪稿破圖的原因，見 HANDOFF Phase 6 第 14 項）
- `media.rotation` 於生成時一併套用（`sharp.rotate()`），前端不再做 CSS 旋轉
- 縮放時保留 EXIF 色彩描述檔，避免色偏

**前端取用**

自訂 `next/image` loader，依 `width` 參數對應到最接近的變體，並輸出 `srcset`：

```tsx
<Image
  src={media.baseKey}
  sizes="(max-width: 768px) 100vw, 1600px"
  ...
/>
```

**原檔保護**：`original.jpg` 不放入公開讀取路徑，僅透過後台的 signed URL 取得。
避免完整解析度的作品原檔被直接抓取。

## 2. 資料模型

使用 Drizzle ORM。以下為 schema 定義。

### 2.1 `users`

```ts
{
  id: text (PK, cuid)
  email: text (unique, not null)
  name: text
  role: text — 'owner' | 'admin'
  createdAt: integer (timestamp)
}
```

Auth.js 所需的 `accounts` / `sessions` / `verificationTokens` 表依官方 Drizzle adapter 標準建立。

### 2.2 `collections`（作品系列）

```ts
{
  id: text (PK, cuid)
  slug: text (unique, not null)         // 'cumedy-night'
  titleEn: text (not null)              // 'Cumedy Night'
  titleZh: text                         // 中文標題（可空）
  year: text                            // '2024'
  category: text                        // 'Womenswear' | 'Menswear' | 'Unisex'
  pieceCount: integer                   // 件數

  // 概念文案
  statementEn: text                     // 英文文案（多行）
  statementZh: text                     // 中文文案（多行）

  // 視覺主題
  theme: text                           // 'dark' | 'light' | 'void'
  accentNote: text                      // 備註此系列的視覺特性（僅後台可見）

  // 封面與分享
  coverImageId: text (FK → media.id)    // 列表頁封面
  ogImageId: text (FK → media.id)       // 社群分享縮圖（獨立指定，不自動抓第一張）

  // 標題圖（手寫字 / 自製 logo）
  titleImageId: text (FK → media.id)    // 可空，有則以圖取代文字標題

  // 存取控制
  visibility: text                      // 'public' | 'unlisted' | 'draft'
  requiresConsent: integer (boolean)    // 進入前是否需年齡／內容提示確認
  consentNoteEn: text                   // 提示文字
  consentNoteZh: text

  sortOrder: integer
  createdAt / updatedAt: integer
}
```

**`visibility` 說明**
- `public` — 出現在首頁列表，可被搜尋引擎索引
- `unlisted` — 不出現在列表，僅限直接連結存取，`noindex`
- `draft` — 僅後台可見

**`theme` 說明**（決定該系列頁的底色系統）
- `dark` — 深底白字
- `light` — 極淺底黑字
- `void` — 純黑底白字

### 2.3 `media`（圖片資產）

```ts
{
  id: text (PK, cuid)
  r2Key: text (not null)                // R2 物件鍵值
  filename: text                        // 原始檔名
  mimeType: text
  width: integer
  height: integer
  fileSize: integer

  rotation: integer (default 0)         // 0 | 90 | 180 | 270 — 前端套用
  focalX: real (default 0.5)            // 裁切焦點 0–1
  focalY: real (default 0.5)

  altEn: text
  altZh: text
  caption: text                         // 可空

  collectionId: text (FK → collections.id, nullable)
  kind: text                            // 'final' | 'detail' | 'sketch' | 'poster' | 'process' | 'misc'

  sortOrder: integer
  createdAt: integer
}
```

**`rotation` 為必要欄位** — 手繪稿掃描檔方向不一致，後台必須提供旋轉功能，不可要求設計師自行用外部工具處理。

**`kind` 說明**
- `final` — 成品照
- `detail` — 材質／細節近拍
- `sketch` — 手繪設計稿
- `poster` — 自製平面海報
- `process` — 製作過程、情境
- `misc` — 其他

### 2.4 `blocks`（頁面區塊）

這是 Block Editor 的核心。每個系列頁由一連串 block 組成。

```ts
{
  id: text (PK, cuid)
  collectionId: text (FK → collections.id, not null)
  type: text (not null)                 // 見下方區塊類型
  config: text (JSON)                   // 該區塊的設定
  sortOrder: integer (not null)
  createdAt / updatedAt: integer
}
```

`config` 為 JSON 字串，結構依 `type` 而定。以 Zod schema 做執行期驗證。

### 2.5 `profile`（單筆設定表）

```ts
{
  id: text (PK, 固定值 'singleton')

  nameEn: text                          // 'Tseng Yu Jui'
  nameZh: text                          // '曾昱睿'
  roleEn: text                          // 'Fashion Designer'
  roleZh: text
  locationEn: text
  locationZh: text

  bioEn: text
  bioZh: text

  email: text
  instagram: text
  behance: text

  heroImageId: text (FK → media.id)     // 首頁主視覺
  aboutImageId: text (FK → media.id)

  seoTitle: text
  seoDescription: text
  defaultOgImageId: text (FK → media.id)

  updatedAt: integer
}
```

### 2.6 `awards`（比賽經歷）

```ts
{
  id: text (PK, cuid)
  year: text (not null)
  titleEn: text (not null)
  titleZh: text
  resultEn: text                        // 'First Place'
  resultZh: text                        // '第一名'
  imageId: text (FK -> media.id, nullable)  // 證書圖片，走後台一般上傳流程
  showCertificate: boolean (not null, default false)  // 是否在關於頁公開展示
                                                        // 這筆的證書（2026-09-14 追加，見 §10.4）
  sortOrder: integer
}
```

**初始資料**（seed）

| year | titleZh | resultZh |
|---|---|---|
| 2023 | 嶺東科技大學服飾設計系時裝週 | 第一名 |
| 2025 | 嶺東科技大學服飾設計系第七屆畢業展 | 第三名 |
| 2026 | 金點新秀設計獎 | （證書未載明名次，待確認） |
| 2026 | 武漢長江盃 | 優勝 |

> 「金點新秀設計獎」一列已依 `服飾設計/獎狀/金點新秀設計獎.jpg` 證書原文校正
> （原表誤將獎項全名拆成 titleZh「金點設計獎」/ resultZh「金點新秀」兩欄）。
> 證書資訊：Young Pin Design Award 2026、參賽類別「時尚設計類」、
> 作品名稱「未完待酗 / Cumedy Night」、中華民國115年5月25日。證書上沒有
> 名次／等第文字，resultZh 待業主確認後填入（或留空僅呈現獎項名稱）。
> titleEn 可用證書英文名 "Young Pin Design Award"。
> 此獎狀圖片改走後台一般上傳流程並關聯本節新增的 `awards.imageId` 欄位，
> 不隨素材匯入腳本處理——證書內含簽名與官印，不適合進入公開圖片路徑。

英文對照需請設計師提供或由開發者草擬後確認。

---

## 3. 區塊類型規格（Block Editor）

以下為 v1 提供的區塊。每個區塊需在後台有對應的編輯表單與即時預覽。

### 3.1 `full-bleed`（滿版單圖）

```json
{
  "mediaId": "…",
  "height": "screen" | "large" | "auto",
  "overlayText": { "en": "", "zh": "" },
  "overlayPosition": "center" | "bottom-left" | "bottom-right" | "none"
}
```

### 3.2 `single`（置中單圖）

```json
{
  "mediaId": "…",
  "width": "narrow" | "medium" | "wide",
  "caption": { "en": "", "zh": "" }
}
```

### 3.3 `pair`（雙圖並列）

```json
{
  "leftMediaId": "…",
  "rightMediaId": "…",
  "ratio": "1:1" | "2:3" | "3:2",
  "gap": "none" | "small" | "large",
  "offset": boolean          // 右圖是否垂直偏移
}
```

### 3.4 `triptych`（三圖橫排）

```json
{
  "mediaIds": ["…", "…", "…"],
  "gap": "none" | "small" | "large"
}
```

### 3.5 `statement`（文案區）

```json
{
  "textEn": "…",
  "textZh": "…",
  "size": "small" | "medium" | "large" | "display",
  "align": "left" | "center",
  "rhythm": "normal" | "spacious" | "tightening"
}
```

**`rhythm` 說明** — 控制行距節奏，對應三個系列的不同體感：
- `normal` — 標準行距
- `spacious` — 大行距，每句之間額外留白（用於「淨土」系列）
- `tightening` — 行距逐句遞減，模擬呼吸急促（用於 X-venom 系列）

### 3.6 `text-image`（圖文混排）

```json
{
  "mediaId": "…",
  "textEn": "…",
  "textZh": "…",
  "imageSide": "left" | "right",
  "imageWidth": "third" | "half" | "two-thirds",
  "verticalAlign": "top" | "center" | "bottom"
}
```

### 3.7 `detail-strip`（細節橫向捲動條）

```json
{
  "mediaIds": ["…", "…", "…", "…"],
  "itemHeight": "small" | "medium" | "large",
  "autoScroll": boolean
}
```

用於材質近拍。水平捲動，不換行。

### 3.8 `sketch-cluster`（手繪稿密集排列）

```json
{
  "mediaIds": ["…"],
  "layout": "overlap" | "grid" | "scatter",
  "allowBleed": boolean       // 是否允許出血至畫面邊緣
}
```

手繪稿本質雜亂，此區塊刻意不對齊，與成品照的整齊形成對比。

### 3.9 `spacer`（留白）

```json
{
  "size": "small" | "medium" | "large" | "xlarge"
}
```

### 3.10 `divider`（分隔線）

```json
{
  "style": "hairline" | "none",
  "label": { "en": "", "zh": "" }
}
```

### 3.11 `lens`（球形遮罩互動）

```json
{
  "mediaId": "…",
  "radius": "small" | "medium" | "large",
  "followCursor": boolean
}
```

X-venom 專用。畫面暗化，僅圓形遮罩內清晰，遮罩跟隨游標移動。呼應該系列文案「視線模糊」與設計師自製海報的球體構圖。行動裝置上改為固定置中的圓，隨捲動位移。

### 3.12 `mirror`（鏡像對稱）

```json
{
  "mediaId": "…",
  "axis": "horizontal" | "vertical",
  "gap": "none" | "hairline"
}
```

Cumedy Night 專用。呼應該系列大量出現的鏡面構圖。

---

## 4. 前台頁面規格

### 4.1 路由

```
/                          首頁
/work/[slug]               系列內頁
/about                     關於
/contact                   聯絡（或併入 /about）
```

### 4.2 首頁

**結構（由上而下）**

1. **Hero** — 全螢幕，背景為輪播（見下方「Hero 背景輪播」，原規格只寫單張圖，2026-09-14 追加）。姓名以大字級疊於其上。
2. **系列列表** — 依 `sortOrder` 排列 `visibility === 'public'` 的系列。每筆顯示：封面圖、英文標題、年份、類型（不帶文案摘要，業主已確認維持這個原始規格）。
3. **簡短簡介** — `profile.bioEn` / `bioZh` 節錄。
4. **頁尾** — 信箱、Instagram、版權。

**Hero 進場動效**

僅此一處使用非使用者觸發的動效。單一 orchestrated moment：

1. 一條水平細線由左至右展開（0.8s）
2. 姓名分行由下往上滑入，逐行延遲 0.15s
3. 輔助資訊淡入

全站其餘位置只使用回應使用者動作的動效（hover、展開、切換）。**禁止**每個 section 都套 fade-and-slide-up。文字疊層跟輪播背景各自獨立——動效綁頁面載入，輪播綁自己的自動播放計時器，兩者不互相依賴時序。

**Hero 背景輪播**（2026-09-14 追加，原規格沒有）

- 全站共用單一輪播（不分系列），淡入淡出轉場，預設 6 秒一輪
- 圖片池：每個 `visibility === 'public'` 的系列各自貢獻圖片——業主已經在後台（`/admin/collections/[id]`）選定「精選照」的話依選定的圖片與順序；沒選過的系列 fallback 回該系列依 `media.sortOrder` 最前 3 張
- 精選照資料模型：`media.featuredOrder`（整數，可為空）——`null` 代表不是精選照，非空值是它在自己系列精選清單裡的順序
- `prefers-reduced-motion` 時完全停用自動播放，只靜態顯示池子裡的第一張圖

### 4.3 系列內頁 `/work/[slug]`

依 `blocks` 表的 `sortOrder` 依序渲染。

**頁面主題**由 `collections.theme` 決定底色與文字色：

```css
/* dark */
--bg: #0A0A0A;  --fg: #E8E8E8;

/* light */
--bg: #F2F3F4;  --fg: #111111;

/* void */
--bg: #000000;  --fg: #FFFFFF;
```

**內容提示**：若 `requiresConsent === true`，進入該頁前顯示全螢幕提示層，內容取自 `consentNoteEn` / `consentNoteZh`，提供「進入」與「返回」兩個選項。確認後寫入 `sessionStorage`，同一 session 內不重複詢問。

**系列間導航**：頁尾提供「上一個系列 / 下一個系列」。

### 4.4 關於頁

- `profile.bioEn` / `bioZh`
- 比賽經歷列表（`awards`，依 `sortOrder`）
- `profile.aboutImageId`
- 聯絡資訊

---

## 5. 視覺系統

### 5.1 色彩

**介面色僅三色系**（導航、頁尾、按鈕、UI 文字）：

```css
--ui-black:  #0A0A0A;
--ui-gray:   #6B6B6B;
--ui-white:  #F2F3F4;
```

**作品區色彩由該系列決定**（見 4.3 的 theme）。照片本身的顏色不做任何濾鏡處理。

> 註：業主原始需求為「黑灰白三色」。實際作品色調差異極大（Cumedy Night 以紅為簽名色、淨土為近白高調、X-venom 為卡其軍綠與鏽紅），若強制統一將嚴重削弱作品表現。本規格採「介面嚴格黑灰白、作品區跟隨作品」的折衷方案。**此決策需業主確認。**

### 5.2 字體

**全站僅使用無襯線 grotesque**。禁止使用襯線體 — 參考案例（HELIOT EMIL、UY STUDIO、JUUN.J、Maison Margiela concept、GAUCHERE、YEBOUN）無一使用襯線，且設計師作品調性為當代／概念導向而非古典時裝屋。

```
Display / 標題    Neue Haas Grotesk Display / Helvetica Now Display
                 開源替代：Inter Tight (weight 500–600)

UI / 內文         Inter (weight 300–400)

中文             Noto Sans TC (weight 300–500)
```

**字級尺度**

| 用途 | 桌機 | 手機 | 字距 |
|---|---|---|---|
| Hero 姓名 | clamp(5rem, 14vw, 13rem) | — | -0.02em |
| 系列標題 | clamp(3rem, 8vw, 7rem) | — | -0.01em |
| Statement large | clamp(2rem, 4vw, 3.5rem) | — | -0.005em |
| 內文 | 0.95rem | 0.9rem | 0 |
| UI / Meta | 0.65rem | 0.62rem | **0.18em** |

**關鍵**：UI 與 metadata 字級極小（10–11px）但字距拉得極開。這是參考案例的共同語彙，讓介面近乎消失。

**禁止事項**（AI 生成頁面的常見特徵）
- 標題中單獨強調某一個字（變色／斜體／粗體）
- 全大寫的小標籤（eyebrow label）
- 用 `·` 串接的 meta 字串
- 連結文字後面加 `→`

### 5.3 間距

基準單位 8px。Section 間距使用 `clamp()` 響應式：

```css
--space-section: clamp(4rem, 10vw, 12rem);
--space-block:   clamp(2rem, 5vw, 6rem);
--gutter:        clamp(1.25rem, 4vw, 3rem);
```

### 5.4 各系列的排版體感

三個系列共用同一套區塊，但透過區塊選擇與參數產生不同節奏：

**Cumedy Night**（緊繃、雜亂、擁擠）
- 大量使用 `pair` 搭配 `offset: true`
- `mirror` 區塊呼應鏡面母題
- `spacer` 使用 `small`
- 圖片可重疊、出血

**在最後的淨土上孤獨**（空曠、緩慢）
- 大量 `single` + `width: narrow`
- `spacer` 使用 `large` / `xlarge`
- `statement` 使用 `rhythm: spacious`
- 每屏只有一個元素，強迫放慢捲動

**X-venom**（失控、壓迫）
- 開場使用設計師自製海報（`full-bleed`）
- `lens` 區塊製造窺看感
- `statement` 使用 `rhythm: tightening`
- `detail-strip` 展示尖刺與布料細節

---

## 6. 語言系統

### 6.1 機制

**不使用傳統 i18n 路由**（無 `/en` `/zh` 前綴）。兩種語言永遠同時存在於 DOM 中，切換改變的是**視覺層級**。

```tsx
// 狀態
type Lang = 'en' | 'zh'

// DOM 結構
<div data-lang={lang}>
  <span className="lang-en">Tseng Yu Jui</span>
  <span className="lang-zh">曾昱睿</span>
</div>
```

```css
/* EN 模式（預設）：英文為主，中文為輔 */
[data-lang="en"] .lang-en { font-size: 1em;    opacity: 1;   }
[data-lang="en"] .lang-zh { font-size: 0.55em; opacity: 0.55; }

/* ZH 模式：主從對調 */
[data-lang="zh"] .lang-zh { font-size: 1em;    opacity: 1;   }
[data-lang="zh"] .lang-en { font-size: 0.55em; opacity: 0.55; }
```

### 6.2 優點

- 兩種語言都在 DOM 中，SEO 完整
- 無需路由分岔、無需 middleware
- 切換是純 CSS class 變更，零延遲
- 符合業主「英文為主中文為輔」且「要有語言切換器」的雙重需求

### 6.3 切換器

置於導航列。標示為 `EN / ZH`，當前語言為白色，另一個為灰色。選擇寫入 `localStorage`。

---

## 7. 後台規格

### 7.1 路由

```
/admin                      儀表板
/admin/collections          系列列表
/admin/collections/[id]     系列編輯（含 Block Editor）
/admin/media                圖庫
/admin/profile              個人資料
/admin/awards               比賽經歷
/admin/settings             全站設定（僅 admin）
```

### 7.2 認證

**Auth.js + Email Magic Link**，不使用密碼。

理由：設計師為非技術使用者，密碼管理是額外負擔且易生問題。信箱收連結點擊即登入。

登入後依 `users.role` 決定可見範圍。`/admin/settings` 僅 `admin` 可進入。

### 7.3 圖庫 `/admin/media`

**必要功能**

1. **拖放上傳** — 支援多檔同時上傳，顯示進度
2. **旋轉** — 90° 增量旋轉按鈕，寫入 `media.rotation`
   - ⚠️ 此功能為**必要**，非加分項。設計師提供的手繪稿掃描檔方向不一致（兩批素材皆出現橫躺情形），不可要求他自行用外部工具處理。
3. **焦點設定** — 點擊圖片設定裁切焦點，寫入 `focalX` / `focalY`
4. **kind 分類** — 下拉選擇 final / detail / sketch / poster / process / misc
5. **批次操作** — 多選後批次設定 kind、批次指派至系列、批次刪除
6. **Alt 文字** — 中英各一欄

**上傳流程**

```
選檔 → 前端讀取尺寸 → 產生 presigned URL → 直傳 R2
     → 寫入 media 表 → 回傳縮圖預覽
```

不經過 Next.js server 中轉，避免大檔案造成 timeout。

### 7.4 Block Editor `/admin/collections/[id]`

**版面**

```
┌─────────────────┬──────────────────────────┐
│                 │                          │
│  區塊列表        │   即時預覽                │
│  （可拖曳排序）   │   （iframe，套用該系列主題）│
│                 │                          │
│  [+ 新增區塊]    │                          │
│                 │                          │
├─────────────────┤                          │
│  選中區塊的       │                          │
│  設定表單        │                          │
│                 │                          │
└─────────────────┴──────────────────────────┘
```

**必要功能**

1. **新增區塊** — 彈出選單列出所有區塊類型，含縮圖示意
2. **拖曳排序** — 使用 `@dnd-kit`
3. **複製區塊** — 常用於重複的圖片排列
4. **刪除區塊** — 需二次確認
5. **即時預覽** — 編輯表單變更後 debounce 300ms 更新預覽
6. **圖片選擇器** — 從圖庫挑選，可篩選 kind、可只顯示該系列的圖
7. **草稿 / 發布** — 編輯中的變更先存為草稿，按發布才更新前台

**表單生成**

每個區塊類型對應一個 Zod schema。後台表單由 schema 自動生成，避免為 12 種區塊各寫一份表單。

### 7.5 系列設定

除 Block Editor 外，系列編輯頁需包含：

- 基本資料（slug、中英標題、年份、類型、件數）
- 概念文案（中英，多行文字區）
- 主題選擇（dark / light / void）
- 封面圖、OG 圖、標題圖選擇器
- 公開狀態（public / unlisted / draft）
- 內容提示設定（是否啟用、提示文字中英）

**OG 圖必須獨立指定**，不可自動取用第一張圖。Cumedy Night 系列含裸露內容，若自動抓取可能導致社群平台封鎖或降低觸及。

---

## 8. SEO 與分享

### 8.1 Metadata

每頁使用 Next.js `generateMetadata`：

```ts
{
  title: `${collection.titleEn} — Tseng Yu Jui`,
  description: collection.statementEn 前 155 字,
  openGraph: {
    images: [ogImage url],
    type: 'article',
  },
  robots: visibility === 'unlisted' ? 'noindex, nofollow' : 'index, follow',
}
```

### 8.2 Sitemap

`app/sitemap.ts` 動態產生，僅包含 `visibility === 'public'` 的系列。

### 8.3 結構化資料

首頁加入 `Person` schema.org JSON-LD，含姓名、職稱、所在地、社群連結。

---

## 9. 品質要求

### 9.1 響應式

- 行動優先
- 斷點：`640 / 768 / 1024 / 1280`
- 圖片一律 `max-width: 100%`
- 寬內容（`detail-strip`）於自身容器內水平捲動，頁面 body 不得橫向捲動

### 9.2 無障礙

- 所有圖片需 alt 文字（後台強制填寫）
- 鍵盤焦點可見
- `prefers-reduced-motion` 時停用所有非必要動效
- 色彩對比符合 WCAG AA

### 9.3 效能

目標 Lighthouse 分數：Performance ≥ 90、Accessibility ≥ 95

- 圖片全部經 Cloudflare Image Resizing，`format=auto`
- 首屏圖片 `priority`，其餘 lazy load
- 字體 `display: swap`，preconnect 至字體來源

---

## 10. 內容資料

### 10.1 三個系列

#### 系列一：未完待酗 / Cumedy Night

> ⚠️ **拼字警告：「Cumedy」為刻意設計，絕非筆誤，不可改為「Comedy」。**
>
> 此拼字為整個系列的核心概念：鏡面口紅字跡寫的是 "Cumedy night"、自製保險套包裝品牌為 "CUM.N"、紅色絲襪滿版印花為 "CUMEDY"。Comedy → Cumedy 的字母置換即為此系列的主張。若改為 Comedy 將摧毀作品概念。

- **theme**: `dark`
- **主色**：紅（口紅、絲襪、帽子、保險套包裝、T恤印字）× 銀（金蔥流蘇）
- **攝影語言**：直打閃燈、硬陰影、廁所磁磚、鏡面反射
- **`requiresConsent`**: `true`（含裸露、菸、酒）
- **標題圖建議**：掃描鏡面上的口紅手寫字並去背，作為此系列標題資產

**中文文案**
```
散落的高跟鞋、凌亂的內衣、空了的酒瓶，霓虹燈照著一夜未散的餘溫。
空氣裡瀰漫著酒精、香水與濃烈的情慾，每一件遺落的物品，都像是昨夜放縱後留下的證據。
```

**英文文案**
```
Scattered heels, discarded lingerie, and empty bottles remain beneath the neon glow.
The air is heavy with liquor, perfume, and lingering desire.
Every forgotten object feels like silent evidence of a night consumed by temptation.
```

**素材構成**（依實際匯入結果校正，見 §11.3）：成品照 33 張（含情境、群像）、
自製保險套包裝平面設計（CUM.N）4 款、手繪設計稿 / 設計牆照片 11 張。
原表僅寫成品照 17 張＋平面設計 3 張，漏列手繪稿，且平面設計實際是 4 款不是 3 款。

---

#### 系列二：在最後的淨土上孤獨 / Alone on the Last Pure Land

- **theme**: `light`
- **主色**：近白、淺灰藍（高調攝影，幾乎無彩度）
- **攝影語言**：無縫淺灰藍背景、柔光、大量留白、機能布料抽褶與 mesh 網布
- **`requiresConsent`**: `false`
- **排版原則**：這是三個系列中最空的。每屏一個元素，`spacer` 用 `xlarge`，捲動節奏最慢

**中文文案**
```
這是哪裡⋯為何世界如此寂靜..
我不疾不徐的呼吸著空氣試圖掩蓋自己的不安
這可能就是未來吧。即使到了未來我還是一樣孤獨的活著
唯一不同的是我感受著無人的風滑過臉頰，腳踩著無垢的白沙，與這片淨土合而為一。
這片土地還有人嗎？我該尋找剩下的人類嗎？
⋯⋯不曉得 我沈靜在一個人的世界，呼吸著寧靜與祥和
守護著我溫柔的孤獨
```

**英文文案**
```
Where is this... Why is the world so silent?
I breathe steadily, trying to mask my unease.
This must be the future. Even in the future, I live in the same solitude.
The only difference now is feeling the unmanned wind brush against my cheek,
my feet sinking into the pure white sand, becoming one with this untouched land.
Is there anyone left on this earth? Should I seek out the remaining humans?
… I don't know. I find peace in this solitary world, breathing in the stillness and serenity.
Guarding my gentle loneliness.
```

> 文案原文為斷續的內心獨白，換行本身即為節奏。渲染時**必須保留原始換行**，使用 `white-space: pre-line`，不可自動合併段落。

**素材構成**（依實際匯入結果校正，見 §11.3）：成品照 7 張、布料細節近拍 3 張、
情境照 3 張、手繪設計稿 6 張（⚠️ 掃描檔方向為橫躺，需旋轉）。
原表寫成品照 8 張，實際是 7 張成品＋3 張近拍細節（原被歸在同一類）。

**Hero 首選**：低角度仰拍、袖片如翅膀向兩側延伸出畫面的那張（原檔 `IMG_1820`）

---

#### 系列三：X-venom

- **theme**: `void`
- **主色**：卡其軍綠 × 鏽紅 × 噴漆黑
- **攝影語言**：低角度、側逆光、深藍灰背景、戲劇性陰影
- **`requiresConsent`**: `false`
- **關鍵資產**：設計師已自製系列海報（黑底、球形鏡頭構圖、破碎筆刷字體的 X / VENOM）。此海報即為該系列現成的視覺系統，**開場區塊直接使用它**，不另行設計標題字。

**中文文案**
```
隨著視線模糊，刺痛伴隨著血液流動蔓延到全身
身體開始劇烈變化，長出了尖刺，身體的中毒反應，使得身上出現了斑點
面對強大的毒素神經系統宣告戰敗
取而代之的是疾病支配著這具殘破的空殼
```

**英文文案**
```
As my vision blurred, the stinging sensation spread throughout my body, carried by the flow of blood.
My body began to undergo violent changes, sprouting spikes as the poison coursing through me caused spots to appear on my skin.
Faced with the overwhelming toxin, my nervous system finally surrendered.
In its place, the disease took control, dominating this broken, hollow shell.
```

**排版原則**：文案描述「逐步失控」的過程。`statement` 區塊使用 `rhythm: tightening`，行距逐句遞減。`lens` 區塊呼應「視線模糊」與海報的球體構圖。

**素材構成**（依實際匯入結果校正，見 §11.3）：成品照 8 張、材質細節近拍 4 張、
歸類為 poster 的檔案 6 款——其中 `IMG_0865`（無字版）／`IMG_0867`（有字版）
是目視確認的海報本體（黑底球形鏡頭構圖），其餘 4 款（`Capture One
Catalog21384`、`IMG_0868`、`IMG_1824`、`IMG_1826`）風格相近但屬成品類影像，
依業主指示一併歸類為 poster。**沒有手繪設計稿**——原表寫的「成品照 12 張、
海報 2 張、手繪稿 4 張」與實際素材不符，已於匯入階段逐張目視核對確認。

---

### 10.2 比賽經歷

見 2.6 的 seed 資料。

### 10.3 尚待業主提供

以下欄位先以 placeholder 建置，待業主提供後填入：

- [ ] 三個系列各自的年份、類型（女裝/男裝/中性）、件數
- [ ] 個人簡介 bio（中英）
- [ ] 正式聯絡信箱
- [ ] Instagram 帳號
- [ ] 比賽經歷的英文譯名
- [ ] 「淨土」系列是否有類似其他兩系列的手寫／自製標題資產

### 10.4 待業主確認的決策

- [ ] **Cumedy 拼字** — 確認保留原拼字（規格書已按保留處理）
- [ ] **色彩策略** — 介面黑灰白、作品區跟隨作品（偏離原始「全站黑灰白」需求）
- [ ] **Cumedy Night 的內容提示** — 是否啟用進入前確認
- [x] ~~內容提示層目前設定成「每次重新進來都要點一次進入」~~ — **已確認**
      （2026-09-15）。業主選擇維持現狀：同一分頁內不重複詢問，但開新分頁
      或下次造訪都會再顯示一次。不需要程式改動。
- [x] ~~是否在關於頁展示獲獎證書~~ — **已確認並上線**（2026-09-15）。業主
      決定公開展示。證書圖（`服飾設計/獎狀/金點新秀設計獎.jpg`）已透過
      後台一般上傳流程（非素材匯入腳本）處理，`awards.imageId` 與
      `showCertificate=true` 皆已寫入，關於頁已顯示。
- [x] ~~次要語言文字的透明度數值（0.55）在淺色主題下沒有通過無障礙對比標準~~
      — **已修復**（2026-09-15）。採用規格書原文提出的方案：`theme: light`
      系列另外給一個更高的數值 `0.65`（實測 4.05:1 → 通過 AA），`dark`/
      `void` 主題與沒有系列主題的頁面（首頁、關於頁）維持規格原文的
      `0.55` 不變。見 `src/app/globals.css`
      `[data-theme="light"] .lang-*` 覆寫規則、
      `src/components/blocks/render/block-render.tsx` 新增的
      `data-theme` 屬性。
- [ ] **Cumedy Night 成品照數量偏多** — 實際匯入 33 張成品照，遠超過原規劃的
      17 張。**業主已確認要自己在後台重新挑選編排**（2026-09-15），不需要
      工程端代為決定要用哪幾張；目前 seed blocks 仍是少數幾張佔位，維持
      現狀等業主編排。
- [x] ~~已知 UI 限制：多圖選擇器（`MediaMultiPicker`）不支援拖曳排序~~ —
      **已解決**（2026-09-14）。`MediaMultiPicker`（現在在
      `src/components/admin/media-picker.tsx`）已經補上拖曳排序，已選圖片
      獨立顯示一排、用 `@dnd-kit` 拖曳調整順序（跟區塊列表本身的排序同一
      套邏輯），移除改成縮圖右上角的 × 按鈕。Block Editor 的
      `triptych`/`detail-strip`/`sketch-cluster` 跟首頁精選照選擇器
      （SPEC §4.2 輪播）共用這支升級後的元件，不是兩套排序手感並存。
- [x] ~~工程端暫定數值，待設計端或業主確認：部分區塊的字級~~ — **維持現值**
      （2026-09-15）。業主指示這批 §10.4 項目可以開始推進，沒有另外提供
      新的數字，故先沿用工程端內插值作為現行版本；若日後設計師實際看過
      視覺後想調整，屬於單純改常數，隨時可再調。見
      `src/components/blocks/render/block-render.tsx`。§5.2 只明確定義
      了 Statement large 一組 clamp（`clamp(2rem, 4vw, 3.5rem)`）、內文
      （0.9rem/0.95rem）、UI/Meta（0.62rem/0.65rem）。下列數字是工程端
      依這幾組既有數字內插出來的，不是規格書白紙黑字給的：
      - `statement` 區塊 `size: small`：`clamp(1rem, 2vw, 1.25rem)`，字距 0
      - `statement` 區塊 `size: medium`：`clamp(1.5rem, 3vw, 2rem)`，字距 -0.005em
      - `statement` 區塊 `size: display`：`clamp(2.75rem, 6vw, 5rem)`，字距 -0.01em
      - `full-bleed` 區塊的疊字（`overlayText`）：`clamp(1.5rem, 4vw, 2.5rem)`，字距 -0.005em

      （`single` 的 caption、`text-image` 的內文、`divider` 的 label 用的
      是 §5.2 已經明確給的內文/UI-Meta 數字，不算暫定——但把哪個角色歸類
      成「內文」還是「UI/Meta」是工程端的判斷，例如 `divider` label 目前
      套用 UI/Meta 尺度，如果設計師覺得應該更接近內文尺度，也可以提出。）

---

## 11. 素材匯入（Asset Ingestion）

### 11.1 素材位置

業主提供的原始素材存放於專案根目錄下的 `服飾設計/` 資料夾。此資料夾為**唯讀來源**，
開發過程中不得修改、刪除或重新命名其中檔案。

實際結構為 `{系列名}/{子資料夾}/` 單層，子資料夾命名不一致，
且檔名規則與內容類型**不存在可靠對應**（見 11.3）。

另有兩個資料夾**不屬於作品素材**：

- `web參考圖/` — 競品網站靈感圖，僅供開發參考，不匯入圖庫
- `獲獎/` — 比賽獲獎相關，內含與本專案無關的檔案，需人工篩選

### 11.2 中文路徑處理

資料夾名稱含中文字元。實作時注意：

- 所有 shell 指令中的路徑**必須加引號**
- Node.js `fs` 操作使用 `path.join()`，不要用字串串接
- **禁止**將中文路徑寫入任何會出現在 URL 或 R2 key 的位置
- R2 的 `key` 一律使用 ASCII：`{collection-slug}/{kind}/{cuid}/{size}.webp`

集中管理來源路徑：

```ts
// src/lib/constants.ts
export const ASSET_SOURCE_DIR = path.join(process.cwd(), '服飾設計')
```

> ⚠️ macOS 的 Finder 會將 `/` 顯示為路徑分隔，但在 POSIX 層儲存為 `:`。
> 若資料夾名含冒號，shell 與部分 Node 套件會出錯。所有資料夾名須確認不含 `:`。

### 11.3 匯入：manifest 兩段式

**不得**讓腳本自行推斷每個檔案的歸屬。改為「掃描 → 人工校正 → 套用」三步驟。

#### 為何不能自動推斷

實際檔名與內容類型無穩定對應關係，舉例：

| 檔名 | 實際內容 | 若照檔名規則推斷 |
|---|---|---|
| `IMG_0889`–`0894` | 手繪設計稿（橫躺，需旋轉） | sketch ✅ |
| `IMG_0848` `IMG_0864` | 成品照 | sketch ❌ |
| `IMG_0859` `IMG_0865` | 自製系列海報 | sketch ❌ |
| `IMG_0867` `IMG_0868` | 數位合成圖 | sketch ❌ |
| `IMG_1820`–`1822` | 淨土系列情境照 | — |
| `IMG_1824` `IMG_1826` | X-venom 系列海報 | — |

`IMG_08xx` 同時涵蓋手繪、成品、海報、合成圖四種類型；
`IMG_18xx` 跨兩個不同系列。任何檔名規則都會產生誤判。

**已確認事實**：需要旋轉的僅有 `IMG_0889`–`0894` 共六張（淨土系列手繪稿）。
其餘檔案方向正常。X-venom 系列**沒有**手繪稿。

#### Step 1 — 掃描

```bash
pnpm tsx scripts/ingest-assets.ts --scan
```

行為：

1. 遞迴掃描 `服飾設計/`，排除 `web參考圖/`
2. 對每個影像檔以 `sharp` 讀取尺寸、格式、檔案大小
3. 計算檔案內容的 SHA-256（用於去重與冪等）
4. 輸出 `ingest-manifest.json` 至專案根目錄

**此步驟不上傳、不寫資料庫、不修改任何來源檔案。**

#### Step 2 — 人工校正 manifest

`ingest-manifest.json` 格式：

```json
{
  "generatedAt": "2026-01-01T00:00:00Z",
  "sourceDir": "服飾設計",
  "items": [
    {
      "sourcePath": "在最後的淨土上孤獨/設計圖/IMG_0889.jpeg",
      "sha256": "a3f2…",
      "width": 3508,
      "height": 2480,
      "fileSize": 4821004,
      "mimeType": "image/jpeg",

      "collection": "pure-land",
      "kind": "sketch",
      "rotation": 90,
      "sortOrder": 1,
      "altEn": "",
      "altZh": "",
      "include": true,
      "note": "掃描檔橫躺，需旋轉"
    }
  ]
}
```

**腳本填入**（唯讀資訊）：`sourcePath` `sha256` `width` `height` `fileSize` `mimeType`

**人工填入 / 校正**：`collection` `kind` `rotation` `sortOrder` `alt*` `include`

- `collection` — `cumedy-night` / `pure-land` / `x-venom`
- `kind` — `final` / `detail` / `sketch` / `poster` / `process` / `misc`
- `rotation` — `0` / `90` / `180` / `270`
- `include` — `false` 者跳過（用於排除混入的無關檔案）

腳本**可以**提供推測值作為起點，但必須在每筆加上 `"confidence": "guess" | "confirmed"`，
且 `--apply` 時若存在任何 `guess` 項目，須警告並要求 `--force` 才繼續。

#### Step 3 — 套用

```bash
pnpm tsx scripts/ingest-assets.ts --apply
```

行為：

1. 讀取 `ingest-manifest.json`，以 Zod 驗證格式
2. 跳過 `include: false` 的項目
3. 對每個項目：
   - 以 `sharp` 套用 `rotation`
   - 生成 400 / 800 / 1600 / 2400 的 WebP 變體（不放大）
   - 移除 EXIF，僅保留 sRGB 色彩描述檔
   - 上傳全部變體 + 原檔至 R2
   - 寫入 `media` 表
4. 輸出匯入報告

**必要特性**

- **冪等** — 以 `sha256` 去重，重複執行不產生重複紀錄
- **可中斷續傳** — 記錄已完成的 sha256，中斷後重跑只處理剩餘
- **進度顯示** — 素材 50+ 張且單檔數 MB，需顯示每檔進度
- **失敗不中止** — 單檔失敗記錄後繼續，最後統一報告

#### 匯入報告格式

```
✓ 匯入完成

  cumedy-night    final 15  poster 3
  pure-land       final 10  sketch 6  process 3
  x-venom         final 12  poster 4

  已套用旋轉      6 張
  略過（include:false）  2 張
  失敗            0 張

  R2 物件數       {n}
  總上傳量        {size}
```

### 11.4 內容 seed

素材匯入後，另建 `scripts/seed-content.ts`：

1. 建立三筆 `collections`，內容取自本規格第 10.1 節（標題、文案、theme、visibility、requiresConsent）
2. 建立四筆 `awards`，內容取自第 2.6 節
3. 建立 `profile` 單筆紀錄，未提供的欄位留空
4. 為每個系列產生**初始 blocks 配置**，依第 5.4 節的排版體感：

   **cumedy-night**（緊繃擁擠）
   ```
   full-bleed(hero) → statement(medium) → pair(offset) → mirror
   → pair(offset) → detail-strip → statement(small) → triptych
   ```

   **pure-land**（空曠緩慢）
   ```
   full-bleed(hero) → spacer(xlarge) → single(narrow) → spacer(xlarge)
   → statement(large, spacious) → spacer(xlarge) → single(narrow)
   → spacer(large) → sketch-cluster → single(narrow)
   ```

   **x-venom**（失控壓迫）
   ```
   full-bleed(poster) → statement(medium, tightening) → lens
   → pair → detail-strip → statement(small, tightening)
   → sketch-cluster → single
   ```

   區塊中的 `mediaId` 依該系列已匯入的圖片依序填入。這只是起始配置，設計師後續可在後台自由調整。

### 11.5 部署前的清理

`服飾設計/` 資料夾**不應納入版本控制，也不應部署**。

在 `.gitignore` 加入：

```
服飾設計/
```

素材的正式來源是 R2，本機資料夾僅供初次匯入使用。

---

## 12. 資訊安全

本專案雖為個人作品集，但含有後台系統、檔案上傳與第三方憑證，安全性需按一般
production 應用處理，不因規模小而降低標準。

### 12.1 威脅模型

| 風險 | 影響 | 對策 |
|---|---|---|
| 未授權者登入後台 | 內容竄改、刪除 | Email 白名單 + Magic Link + session 保護 |
| Magic Link 遭暴力嘗試 | 帳號接管 | 速率限制 + token 短效期 + 單次使用 |
| 惡意檔案上傳 | 儲存體濫用、XSS | MIME 白名單 + 大小上限 + 內容驗證 + 私有 bucket |
| R2 憑證外洩 | 資產全毀、帳單暴增 | 憑證僅存於 server env、最小權限、定期輪替 |
| SQL injection | 資料外洩 | Drizzle 參數化查詢（預設）+ 禁用 raw SQL 拼接 |
| XSS（後台輸入的文案） | Session 竊取 | 輸出跳脫 + 禁用 dangerouslySetInnerHTML + CSP |
| CSRF | 冒名操作 | Auth.js 內建 CSRF token + SameSite cookie |
| 草稿內容提前外洩 | 作品在公開前曝光 | `visibility` 於 server 端過濾，非前端隱藏 |
| 圖片原檔被大量抓取 | 高解析作品外流 | 原檔不公開、僅 signed URL |

### 12.2 認證與授權

**登入方式**：Auth.js v5 + Email Magic Link，**不使用密碼**。

**白名單限制**（重要）

Magic Link 的預設行為是「任何 email 都能請求登入連結」。本站只有兩位使用者，
必須擋掉白名單以外的信箱。

> ⚠️ **不要把白名單判斷放在 `signIn` callback。** 這是原本的作法，實測後發現
> 一個問題：`signIn` 回傳 `false` 時，Auth.js（`@auth/core` 的
> `actions/signin/send-token.js`）會直接 throw `AccessDenied`，導向
> `/admin/login/error?error=AccessDenied`；回傳 `true` 則正常導向
> `/api/auth/verify-request`。兩條路徑從重導向網址開始就不同——即使錯誤頁
> 文字寫得再通用，攻擊者不用看文字，光看自己被導去哪個網址就能判斷任何
> 信箱在不在白名單，等於還是能枚舉帳號，違背下面 §12.9 的要求。
>
> 更麻煩的是，Auth.js 內部在 `signIn` 通過後是用
> `Promise.all([sendVerificationRequest(...), adapter.createVerificationToken(...)])`
> 平行呼叫寄信與寫入 token，兩者互不等待、互不感知對方結果。這代表「只把
> 白名單判斷搬進 `sendVerificationRequest`，裡面 return 不寄信」並不足夠：
> `createVerificationToken` 是另一條平行路徑，不會因為 `sendVerificationRequest`
> 內部悄悄跳過寄信就跟著不寫資料庫，非白名單信箱一樣會在
> `verification_tokens` 留下一筆紀錄，只是沒收到信。
>
> **正確作法**：`signIn` callback 一律回傳 `true`（確保兩種情況重導向網址
> 逐字元相同），白名單判斷改成在兩個真正各自獨立執行的地方都各自把關：
> - `adapter.createVerificationToken`：非白名單直接 `return`，不寫入資料庫
> - `provider.sendVerificationRequest`：非白名單直接 `return`，不寄信
>
> 實作見 `src/auth.ts`。已用真實信箱（白名單內／白名單外各一個）跑過完整
> HTTP 流程驗證：兩者重導向網址逐字元相同、白名單外的信箱在
> `verification_tokens` 與 `users` 都沒有留下任何紀錄、白名單內的信箱仍能
> 正常收到信、完成登入、token 單次使用後失效。

**Token 設定**

- Magic Link 有效期：**10 分鐘**（預設 24 小時過長）
- Token 單次使用，驗證後立即失效
- Session 有效期：7 天，`updateAge` 24 小時

**Cookie 設定**

```ts
cookies: {
  sessionToken: {
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    }
  }
}
```

**授權檢查必須在 server 端**

```
❌ 錯誤：前端判斷 role 後隱藏按鈕
✅ 正確：每個 Server Action / Route Handler 開頭驗證 session 與 role
```

建議建立統一的 guard：

```ts
// lib/auth-guard.ts
export async function requireAuth(role?: 'owner' | 'admin') {
  const session = await auth()
  if (!session?.user) throw new Error('UNAUTHORIZED')
  if (role === 'admin' && session.user.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }
  return session
}
```

所有 `/admin` 下的 Server Action **一律**以此開頭，不得省略。

**Middleware 保護**

`middleware.ts` 攔截 `/admin/*` 與 `/api/admin/*`，未登入者導向登入頁。
但 middleware **不是唯一防線** —— Server Action 仍需各自驗證，
因為 Server Action 可被直接呼叫而不經過 middleware。

### 12.3 速率限制

使用 `@upstash/ratelimit` + Upstash Redis（免費額度足夠）。

| 端點 | 限制 | 識別依據 |
|---|---|---|
| 登入請求（送出 Magic Link） | 5 次 / 10 分鐘 | IP + email |
| 檔案上傳 | 30 次 / 10 分鐘 | user id |
| 其他 admin 寫入操作 | 100 次 / 分鐘 | user id |
| 公開頁面 | 不限制 | — |

登入端點的限制**最為關鍵**。無此限制者，攻擊者可對任意 email 大量發送登入信，
造成信箱轟炸與 SMTP 額度耗盡。

### 12.4 檔案上傳

**驗證順序**（缺一不可）

1. **副檔名白名單**：`.jpg` `.jpeg` `.png` `.webp`
2. **MIME 白名單**：`image/jpeg` `image/png` `image/webp`
3. **檔案大小上限**：單檔 25 MB
4. **magic bytes 驗證**：以 `file-type` 套件讀取實際檔頭，
   確認與宣告的 MIME 相符。僅檢查副檔名與 `Content-Type` 是可被偽造的。
5. **以 sharp 重新編碼**：所有上傳圖片經 sharp 處理後輸出，
   此步驟會剝除潛在的惡意 payload 與不必要的 EXIF。

**EXIF 處理**

原始照片可能含 GPS 座標、相機序號、攝影師姓名等資訊。
生成公開變體時**移除所有 EXIF**，僅保留色彩描述檔：

```ts
sharp(input)
  .rotate(rotation)
  .resize(width)
  .webp({ quality: 82 })
  .withIccProfile('srgb')   // 只留色彩描述檔，不留 GPS/裝置資訊
```

> ⚠️ **不要用 `.withMetadata({ icc: 'srgb' })`**——實測過，那個呼叫會把來源檔案的
> EXIF（含 GPS）整包保留下來，`icc` 選項只是額外覆寫色彩描述檔，不會讓
> `withMetadata()` 變成「只留 icc」。sharp 預設（完全不呼叫
> `withMetadata`/`keepExif` 之類的方法）本來就會移除所有 metadata；
> `.withIccProfile('srgb')` 是獨立方法，只補回色彩描述檔，兩者合併才是
> 規格要的「移除 EXIF、僅保留色彩描述檔」。

**R2 key 生成**

```
✅ {slug}/{kind}/{cuid}/1600.webp
❌ {原始檔名}                        — 可能含中文、空白、路徑穿越字元
```

原始檔名僅存於 `media.filename` 供後台顯示，**永不用於路徑組成**。

**presigned URL**

- 有效期：**5 分鐘**
- 限定 HTTP method 為 `PUT`
- 限定 `Content-Type` 與 `Content-Length`
- 產生前須通過 `requireAuth()` 與速率限制

**Bucket 權限**

R2 bucket 設為**私有**。公開讀取透過下列其一：
- 方案 A：R2 public bucket 僅開放 `{slug}/{kind}/{cuid}/{400,800,1600,2400}.webp` 路徑，
  `original.jpg` 置於另一個私有 bucket
- 方案 B：全私有，經 Next.js Route Handler 代理讀取並設定長效快取

**已採用方案 A**：`R2_BUCKET_NAME`（公開，只放 WebP 變體）與
`R2_ORIGINALS_BUCKET_NAME`（私有，只放 `original.*`）是兩個不同的 bucket，
不是同一個 bucket 底下的不同路徑——素材匯入腳本（`scripts/ingest-assets.ts
--apply`）與後台上傳流程共用的 `generateAndUploadVariants()` pipeline
都是分別呼叫兩個 bucket 名稱上傳。

### 12.5 輸入驗證

**所有**來自外部的資料（表單、Server Action 參數、Route Handler body、URL params）
一律以 Zod schema 驗證後才使用。

```ts
const UpdateCollectionSchema = z.object({
  id: z.string().cuid(),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(60),
  titleEn: z.string().max(120),
  statementEn: z.string().max(4000),
  theme: z.enum(['dark', 'light', 'void']),
  visibility: z.enum(['public', 'unlisted', 'draft']),
})
```

**Block config 特別注意**：`blocks.config` 為 JSON 字串，
讀取與寫入時都必須以對應的 Zod schema 驗證，不可直接 `JSON.parse()` 後信任。

**slug 白名單**：只允許小寫英數與連字號。避免路徑穿越與 URL 注入。

### 12.6 資料庫

- **一律使用 Drizzle 的查詢建構器**，其輸出為參數化查詢
- 若必須使用 `sql` template，**只能**用其參數插值語法 `sql\`... ${value}\``，
  **禁止**字串串接組 SQL
- Turso auth token 權限設為該 database 專用，不使用帳號層級的 token
- Preview 環境使用獨立 database

**`visibility` 的過濾必須在查詢層**

```ts
✅ db.select().from(collections).where(eq(collections.visibility, 'public'))
❌ 取出全部後在前端 filter
```

草稿與 unlisted 的內容不得出現在公開頁面的 HTML 或 JSON payload 中。

### 12.7 安全標頭

於 `next.config.ts` 設定：

```ts
headers: async () => [{
  source: '/:path*',
  headers: [
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
    { key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload' },
  ],
}]
```

**Content Security Policy**

```
default-src 'self';
img-src 'self' data: blob: {R2_PUBLIC_URL};
script-src 'self' 'nonce-{RANDOM}';
style-src 'self' 'unsafe-inline';
font-src 'self' fonts.gstatic.com;
connect-src 'self' {R2_PUBLIC_URL} {UPSTASH_URL};
frame-ancestors 'self';
base-uri 'self';
form-action 'self';
```

Block Editor 的即時預覽使用 iframe，故 `frame-ancestors` 保留 `'self'`。

CSP 建議先以 `Content-Security-Policy-Report-Only` 上線觀察，
確認無誤報後再改為強制模式。

### 12.8 XSS 防範

- 設計師輸入的文案**一律**以 React 的預設跳脫輸出
- **禁止**在專案任何位置使用 `dangerouslySetInnerHTML`
- 若日後需支援富文本，必須加入 `DOMPurify` 或改用結構化的 block 表示
- `media.altEn` / `altZh` / `caption` 同樣視為使用者輸入處理

### 12.9 錯誤處理與日誌

- **production 環境不得向使用者顯示 stack trace 或資料庫錯誤訊息**
- 統一的錯誤回應格式，內部細節僅寫入 server log
- 登入失敗的訊息**不區分**「信箱不存在」與「不在白名單」，
  一律回覆相同文字，避免帳號枚舉
- 日誌**不得記錄**：session token、magic link token、R2 憑證、完整 email（可記錄雜湊）

### 12.10 依賴與憑證管理

- 啟用 GitHub Dependabot，每週檢查依賴漏洞
- CI 加入 `pnpm audit --audit-level=high`
- Repo 設為 **private**
- `.env.local`、`服飾設計/` 均在 `.gitignore` 內
- 若任何憑證曾意外進入 git 歷史，**必須立即輪替**，不可僅刪除檔案
- R2 access key 與 Turso token 建議每半年輪替一次

### 12.11 內容提示層的定位

`requiresConsent` 的提示層是**內容禮貌機制，不是存取控制**。
它不阻擋爬蟲、不阻擋直接請求圖片網址。

若日後需要真正限制存取（例如投遞履歷時提供限定連結），
應使用 `visibility: 'unlisted'` 搭配不可預測的 slug，
或另行實作 token-based 的存取控制。此點需與業主說明清楚。

### 12.12 上線前檢查清單

- [ ] `ALLOWED_LOGIN_EMAILS` 已設定且僅含兩個信箱
- [ ] 所有 Server Action 開頭皆有 `requireAuth()`
- [ ] 登入端點速率限制已啟用並實測
- [ ] 上傳流程的 magic bytes 驗證已實測（嘗試上傳改名的非圖片檔）
- [ ] EXIF 已從公開變體中移除（用 exiftool 抽驗）
- [ ] `original.jpg` 無法由公開網址直接取得
- [ ] 安全標頭已生效（securityheaders.com 檢測）
- [ ] CSP 無誤報後已改為強制模式
- [ ] 草稿系列不出現在 sitemap、首頁列表、任何 JSON payload
- [ ] `unlisted` 系列的頁面含 `noindex, nofollow`
- [ ] production 錯誤頁不洩漏內部訊息
- [ ] `.env.local` 不在 git 歷史中
- [ ] Preview 環境使用獨立 database 與 bucket

---

## 13. 開發順序

建議依下列階段實作，每階段完成後可獨立驗收。

### Phase 1 — 基礎建設
1. Next.js 專案初始化（App Router + TypeScript + Tailwind）
2. `.gitignore` 與 `.env.example`；Vercel 三環境變數分離設定
3. Turso + Drizzle schema 建立與 migration
4. Auth.js Email Magic Link + **信箱白名單**（12.2）+ cookie 設定
5. Upstash 速率限制，套用於登入端點（12.3）
6. 安全標頭與 CSP（Report-Only 模式）（12.7）
7. R2 上傳流程：presigned URL + 完整檔案驗證（12.4）
8. sharp 多尺寸生成 pipeline 與 `next/image` custom loader（1.3）

### Phase 2 — 後台核心
9. `/admin` middleware 保護 + `requireAuth()` guard（12.2）
10. Zod schema 與所有 Server Action 的輸入驗證（12.5）
11. 圖庫：上傳、旋轉、焦點、kind 分類、批次操作
12. 系列 CRUD（不含 Block Editor）
13. Profile 與 Awards 編輯
14. **素材匯入腳本**（第 11 章）— 先跑 `--dry-run` 確認對應關係，再實際匯入
15. **內容 seed 腳本**（第 11.4 節）

> 匯入放在 Phase 2 末尾而非最後，是為了讓 Phase 3 的 Block Editor 與 Phase 4 的前台
> 能直接以**真實照片**開發與驗收。用佔位圖開發版面，到了套真圖時幾乎必然要重調。

### Phase 3 — Block Editor
16. Block schema 與 Zod 驗證（讀寫雙向）
17. 區塊列表與拖曳排序
18. 12 種區塊的編輯表單（schema 驅動自動生成）
19. 即時預覽 iframe
20. 草稿 / 發布機制

### Phase 4 — 前台
21. 設計系統（色彩 token、字體、間距）
22. 語言切換機制
23. 12 種區塊的前台渲染元件
24. 首頁、系列內頁、關於頁（`visibility` 於查詢層過濾）
25. Hero 進場動效
26. 內容提示層

### Phase 5 — 收尾
27. SEO metadata、sitemap、JSON-LD
28. 無障礙檢查
29. 效能優化與 Lighthouse 調校
30. CSP 改為強制模式
31. **走完第 12.12 節的上線前檢查清單**
32. 部署至 Vercel Production

---

## 14. 特別注意事項

1. **「Cumedy」不可改為「Comedy」** — 見 10.1
2. **`服飾設計/` 為唯讀來源** — 不得修改、刪除、重新命名其中任何檔案；不納入版控、不部署
3. **中文路徑不得進入 URL 或 R2 key** — 見 11.2
4. **登入信箱白名單為必要** — 無此限制者任何人皆可索取 Magic Link，見 12.2
5. **每個 Server Action 都必須自行驗證權限** — middleware 不是唯一防線，見 12.2
6. **敏感值不可加 `NEXT_PUBLIC_` 前綴** — 見 1.2
7. **禁止使用 `dangerouslySetInnerHTML`** — 見 12.8
8. **公開圖片變體必須移除 EXIF** — 原檔含 GPS 與裝置資訊，見 12.4
9. **圖片旋轉功能為必要** — 見 7.3
10. **OG 圖必須獨立指定** — 見 7.5
11. **禁止硬編碼網域** — 見 1.2
12. **禁止使用襯線字體** — 見 5.2
13. **淨土系列文案的換行必須保留** — 見 10.1
14. **照片不做任何濾鏡或調色處理** — 攝影本身已完成，前端只負責尺寸與格式轉換
15. **不做 3D 模特** — 專案初期曾討論在首頁放置旋轉 3D 人台模型。經檢視實際攝影素材後決定不實作：設計師的攝影表現力已超越任何 WebGL 渲染，加入 3D 將使網站趨近電商配置器而非作品集。參考的六個時裝品牌網站亦無一使用 3D。
