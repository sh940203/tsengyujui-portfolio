# HANDOFF — 曾昱睿作品集網站

> 交接文件，供下一個 session 直接接手，不需重新翻對話紀錄。
> 完整規格見 [SPEC.md](./SPEC.md)。本文件只記錄「規格書之外」的現況、決策與驗證結果。
>
> 產生時間：2026-09-13（2026-09-14 更新：即時預覽 iframe、草稿/發布機制、發布狀態樂觀更新、共用渲染元件搬遷 + 設計系統、lens 互動修復、`/work/[slug]` 前台頁面、SPEC §6 語言系統、首頁、Hero 背景輪播 + 精選照後台管理、關於頁、內容提示層、SEO/AEO/GEO 收尾、全專案「select 整列」洩漏排查、git 歷史/GitHub/Vercel 上線、無障礙+效能稽核皆已完成；2026-09-15 更新：三系列切公開發布、金點新秀證書上線、SPEC §10.4 大部分項目收斂；2026-09-16～09-19 更新（Phase 6）：EMAIL_SERVER/EMAIL_FROM（Resend）與 Vercel Preview 環境變數皆已由業主補齊、UI/UX 精修批次（導航、圖片顯示、淺色深色切換、統計數字區塊、系列頁釘住標題、首頁 Hero 雙欄同系列配對輪播、後台配對預覽、本機測試登入捷徑）——已全部 commit 並 push（2026-09-22），見 §1.1；2026-09-24～28：關於頁改成「一進來就是獲獎清單」、獲獎跑馬燈搬到首頁，commit `beca9dd` 已 push，見 §1.1 Phase 6 第 18 項；2026-10-22：Phase 7 後台全面改版，業主本機試用後同意，已 commit 並 push，見 §1.1 Phase 7 與 §6）
>
> **上線網址：https://tsengyujui-portfolio.vercel.app**（GitHub：私有 repo `sh940203/tsengyujui-portfolio`）

---

## 1. 專案現況總覽

**目前位置（2026-10-22 更新）**
- **線上（main 最新 commit `beca9dd`，已 push、Vercel 自動部署）**：Phase 1–6 全部，加上 2026-09-24～28 的關於頁／首頁跑馬燈調整（§1.1 Phase 6 第 18 項）。三個系列 `public` 並已發布；Lighthouse（2026-09-15 稽核）首頁/關於頁 Performance 94–99、Accessibility 100、Best Practices 96、SEO 100。
- **Phase 7 後台全面改版（§1.1 Phase 7）已於 2026-10-22 commit 並 push**（main 上 `beca9dd` 的下一個 commit）——後台外框與總覽頁、系列編輯器（含作品長廊隱藏／排序）、圖庫、個人資料、比賽經歷、登入頁全部重做。`tsc`、`eslint src`、`next build` 都通過。
- **資料庫已經變了**：migration `0006_damp_red_skull.sql`（`media.gallery_hidden`、`media.gallery_order` 兩欄，皆有預設值）**已套用到 Turso**——正式站與本機共用同一個資料庫，但目前線上的程式不讀這兩欄，前台行為不變；86 張圖目前全部 hidden=0、order=null。
- **新 session 請先讀**：§1.1 Phase 6 第 17–18 項、Phase 7，以及 §6。

**上線前還差的東西**：~~`EMAIL_SERVER`/`EMAIL_FROM`~~、~~Preview 環境變數~~ 兩項業主都已經自行補齊（Resend 用於 Production、Gmail 用於本機 `.env.local`；Preview 透過 Vercel Dashboard 手動填入，含一組獨立產生的 Preview 專用 `AUTH_SECRET`）——只剩 **Preview 專用的獨立 Turso/R2**（SPEC §1.2 建議，目前跟 Production 共用，非必要）。

### 1.1 已完成並實測驗證的項目

以下項目皆已對**真實 Turso 資料庫**（非 mock、非本地 sqlite）實測，不是只憑編譯通過：

**Phase 1 — 基礎建設**
- Next.js 15.5.25 App Router + TypeScript + Tailwind v4 專案初始化
- Turso + Drizzle schema、9 張表、migration（`drizzle/` 目錄）
- Auth.js v5 Email Magic Link + 信箱白名單 + 速率限制
  - 驗證方式：直接觸發白名單信箱與非白名單信箱的登入流程，確認兩者導向頁面**不可區分**（見下方 bug 清單 #4）；速率限制以連續真實請求觸發，確認第 N+1 次被擋
- R2 上傳流程（presigned URL）、sharp 多尺寸變體生成
  - 驗證方式：實際上傳圖片、檢查 R2 兩個 bucket 內確實產生對應檔案

**Phase 2 — 後台核心**
- `/admin` middleware + `requireAuth()` 全面套用
- 圖庫管理 `/admin/media`：上傳、旋轉、焦點座標、kind 分類、批次操作
  - 驗證方式：實際上傳、旋轉 90°/270°、調整焦點，查詢資料庫確認 `rotation`/`focalX`/`focalY` 落地，並用 sharp 重新讀圖確認 EXIF 已清除、色彩正確
- 系列 CRUD `/admin/collections`
  - 驗證方式：新增、編輯、刪除一個系列，全程查資料庫核對欄位
- Profile 編輯 `/admin/profile`
  - 驗證方式：編輯既有資料、確認空值欄位（bio、信箱）可正常留空儲存
- 素材匯入腳本 `scripts/ingest-assets.ts`（`--scan` / `--contact-sheet` / `--apply` 三步驟）
  - 驗證方式：對真實的 `服飾設計/` 資料夾跑過完整流程，人工核對 manifest 後套用
- `scripts/seed-content.ts` 內容 seed

**Phase 3 — Block Editor**
- 第一批（已驗收）：12 種區塊的 Zod schema、基本 CRUD server actions（新增/刪除/更新單一區塊）、區塊列表頁（依 `sortOrder` 排序）、@dnd-kit 拖曳排序
  - 驗證方式：對 cumedy-night 系列實際新增、刪除、拖曳排序區塊，查資料庫核對
- **第二批（本次剛完成）：表單生成引擎**
  1. `src/lib/blocks/form-schema.ts` — 從 Zod schema 內部結構（`.def.type` 等）反推表單欄位描述（`getFieldDescriptors()`）
  2. 用這套機制實作了 3 種代表性區塊的自動生成表單：**full-bleed**（含圖片選擇器 + enum + 巢狀 `{en,zh}`）、**statement**（3 種 enum：size/align/rhythm）、**spacer**（單一 enum）
  3. `src/app/admin/collections/[id]/blocks/media-picker.tsx` — 縮圖網格選擇器（單選 `MediaPicker` / 多選 `MediaMultiPicker`），從 85 張真實圖庫縮圖中選，不是貼 media id 字串
  4. 其餘 9 種區塊（pair、single、triptych、text-image、detail-strip、sketch-cluster、divider、lens、mirror）暫時仍走舊的通用 JSON textarea（`JsonConfigEditor`），尚未套用生成式表單

  **驗證結果：抽象層驗證通過，沒有發現問題。**
  - 對 cumedy-night 系列（`od9x85brwb41br60iatmph26`）的真實區塊實測：
    - full-bleed（#1）：確認 mediaId 選擇器正確標示目前選中的縮圖（`c6zcy1jxseguotj0uns3h9bv` / `618.jpg`，與資料庫核對相符），修改 `overlayText.en` 與 `overlayPosition` enum 後存檔，查資料庫確認落地，再改回原值存檔並二次核對已完全還原
    - statement（#7，原本是空白內容的區塊，用它測試比較安全）：修改 `textEn`/`textZh`/`size`/`align`/`rhythm` 五個欄位存檔，查資料庫核對，再改回原值並二次核對已完全還原
    - spacer：cumedy-night 原本沒有這個型別的區塊，故臨時新增一個（#9）、修改 `size` enum 存檔並查資料庫核對，測試完直接對該筆 id 做 DB 層刪除移除（未使用 UI 的刪除按鈕，因為瀏覽器自動化環境裡原生 `confirm()` 對話框無法正常互動）
  - 最終核對：cumedy-night 8 筆原始區塊的 `config` JSON 與測試前的 baseline **逐字元相符**
  - 尚未在這 3 種型別中被真實互動觸發的欄位種類：`boolean`、`media-list`（因為 full-bleed / statement / spacer 這三種 schema 剛好都不含這兩種欄位型別，只是結構上存在對應的 render 分支，未經真實存檔驗證）

- **第三批（本次剛完成）：展開至 detail-strip / sketch-cluster，補上 boolean 與 media-list 的真實驗證**
  1. 先用 `getFieldDescriptors()` 對剩餘 9 種區塊（pair、single、triptych、text-image、detail-strip、sketch-cluster、divider、lens、mirror）全部跑過一次，確認沒有任何 `"unknown"` kind 欄位（見下方掃描結果全貌）。
  2. 剩餘 9 種裡，**detail-strip**（`mediaIds` + `autoScroll`）與 **sketch-cluster**（`mediaIds` + `allowBleed`）是唯二同時含 `boolean` 與 `media-list` 兩種未驗證欄位型別的 schema，故本批選這兩種優先展開，加入 `GENERATED_FORM_TYPES`（`block-list-client.tsx`）。
  3. 掃描結果全貌（`getFieldDescriptors()` 實測輸出，非肉眼推斷）：
     - `pair`：leftMediaId(media) / rightMediaId(media) / ratio(enum) / gap(enum) / **offset(boolean)**
     - `single`：mediaId(media) / width(enum) / caption(localized-text)
     - `triptych`：**mediaIds(media-list)** / gap(enum)
     - `text-image`：mediaId(media) / textEn(textarea) / textZh(textarea) / imageSide(enum) / imageWidth(enum) / verticalAlign(enum)
     - `detail-strip`：**mediaIds(media-list)** / itemHeight(enum) / **autoScroll(boolean)** ← 本批選中
     - `sketch-cluster`：**mediaIds(media-list)** / layout(enum) / **allowBleed(boolean)** ← 本批選中
     - `divider`：style(enum) / label(localized-text)
     - `lens`：mediaId(media) / radius(enum) / **followCursor(boolean)**
     - `mirror`：mediaId(media) / axis(enum) / gap(enum)
  4. **驗證結果：boolean 與 media-list 兩種欄位型別皆通過，沒有發現問題。**
     - 對 cumedy-night 系列真實區塊 `detail-strip`（#6，`qx194svxc74kmuj015ou0v9b`）實測：
       - boolean（`autoScroll`）：true→false→true 三態往返，每一步查資料庫確認欄位型別是 `boolean`（非空字串/undefined）
       - media-list（`mediaIds`，原始 4 筆）：新增第 5 筆（附加在陣列末端）→ 移除並重新加入其中一筆（驗證順序調整——目前 `MediaMultiPicker` 元件本身沒有拖曳排序功能，只有點擊切換選取/取消，故「調整順序」是透過「先移除、再重新加入」達成，重新加入會附加到陣列末端；這是目前 UI 唯一能改變順序的操作方式，非本次臨時繞過）→ 刪除單一項目（非全刪，確認其餘筆數與順序不受影響）→ 全部移除後依原始順序逐一重新加入，最終整個 config JSON 逐字元還原成 baseline
     - 因 cumedy-night 沒有既有的 `sketch-cluster` 區塊，臨時新增一筆（sortOrder 9）用兩筆 sketch 類圖片測試，重複同一套 boolean 三態往返與 media-list 新增/調整順序/刪除單一項目流程，全部正確；測試完直接在 DB 層刪除該臨時區塊（因為瀏覽器自動化環境裡原生 `confirm()` 無法互動，比照上一批 spacer 測試的做法）
     - 最終核對：cumedy-night 8 筆原始區塊（不含臨時測試區塊）的 `config` JSON 與測試前的 baseline **逐字元相符**
  5. 其餘 7 種區塊（pair、single、triptych、text-image、divider、lens、mirror）仍走通用 JSON textarea，尚未展開生成式表單。

- **第四批（本次剛完成）：一次展開剩餘 7 種區塊，12 種全部改用生成式表單**
  1. 前兩批已驗證 field renderer 涵蓋所有欄位型別（media / media-list / enum / boolean / textarea / localized-text）且無 `unknown` kind，故本批不再逐一分批，一次把 pair、single、triptych、text-image、divider、lens、mirror 全部加入 `GENERATED_FORM_TYPES`——`block-list-client.tsx` 的 `GENERATED_FORM_TYPES` 現在等於 `BLOCK_TYPES`（全部 12 種），`JsonConfigEditor` 保留作為未來新增區塊類型時的備援路徑，不刪除。
  2. 驗收降級為**單值往返**（不重複跑前兩批的 boolean 三態或 media-list 四操作完整流程）：每種型別挑一個真實或臨時區塊，改一個欄位值 → 存檔 → 查庫核對 → 改回原值 → 二次核對還原。
  3. **驗證結果：全部 7 種型別的單值往返皆通過，沒有發現問題。**
     - `pair`（#3 真實區塊）：boolean `offset` true→false→true
     - `triptych`（#8 真實區塊）：media-list `mediaIds` 新增一筆（附加末端）→ 移除還原
     - `mirror`（#4 真實區塊）：enum `gap` none→hairline→none
     - `single`（臨時新增）：enum `width` medium→wide→medium
     - `text-image`（臨時新增）：enum `imageSide` left→right→left
     - `divider`（臨時新增）：enum `style` hairline→none→hairline
     - `lens`（臨時新增）：boolean `followCursor` true→false→true
     - 4 個臨時區塊（single/text-image/divider/lens）測試完直接在 DB 層刪除，比照前兩批 spacer / sketch-cluster 測試的做法
  4. 過程中發現一個**測試方法論陷阱**（非產品程式碼 bug）：用瀏覽器原生 DOM `click()`/`dispatchEvent` 驅動 React 表單時，若「改欄位值」與「按儲存」在同一個同步區塊內連續呼叫、中間沒有等待，儲存按鈕的 `onClick` closure 可能還沒拿到 React 重新 render 後的最新 `values`，導致存檔內容是修改前的舊值（第一次測 triptych 新增媒材時遇到，DB 核對發現值沒變才抓出來）。修法：兩個操作之間加約 150ms 等待，讓 React 完成重新 render。這只影響測試腳本本身，跟 `GenericBlockForm` 的正式程式碼無關。
  5. **已知 UI 限制（非本次待辦，記錄供未來參考）**：`MediaMultiPicker`（`src/app/admin/collections/[id]/blocks/media-picker.tsx`）目前**不支援拖曳排序**，只能點擊切換選取/取消；要調整 `media-list` 欄位裡圖片的順序，唯一方式是「先移除、再重新加入」（重新加入會附加到陣列末端）。這在功能上是可行的（本次與上一批的媒材順序測試都是靠這個方式完成並驗證正確），但體驗不佳。若業主日後在後台實際編排 `triptych` / `detail-strip` / `sketch-cluster` 這類多圖區塊時反應「順序不好調」，需要補上拖曳排序（例如比照區塊列表已經在用的 `@dnd-kit`）。已同步記錄於 SPEC.md §10.4。
  6. 最終核對：cumedy-night 8 筆原始區塊（不含臨時測試區塊）的 `config` JSON 與測試前的 baseline **逐字元相符**；`tsc --noEmit` 通過。
  7. Phase 3 剩餘項目（12 種區塊表單全部完成後才輪到）：即時預覽 iframe（SPEC.md §13 項目 19）與草稿/發布機制（項目 20）。

- **第五批（本次剛完成）：即時預覽 iframe（SPEC.md §13 項目 19）**

  動工前先討論了三個架構問題，決策記錄如下（都跟業主討論過、不是我自己單方面決定）：
  1. **預覽資料來源**：SPEC §7.4 項目 5 原文「編輯表單變更後 debounce 300ms 更新預覽」——確認是吃**表單裡尚未存檔的即時輸入**，不是存檔後才更新。
  2. **草稿/發布資料模型**（項目 20，這批還沒做，先把決策記錄下來）：選**系列層級快照**，不是逐區塊雙欄位——`collections` 加 `publishedSnapshot`（JSON）+ `publishedAt`，現有的 `blocks` 表與 12 支 block CRUD server action 完全不動，正常編輯即視為草稿，「發布」動作把當下整頁 blocks 序列化寫進快照，前台改讀快照而非即時 `blocks` 表。
  3. **優先順序**：業主目前完全還沒用過後台（還在等內容確認清單），三個系列 `visibility` 也都是 `draft`（沒有任何前台曝光風險），所以先做即時預覽、草稿/發布延後。

  實作前又追問了三個實作面的問題，逐一釐清後才動工：
  1. **狀態彙整會不會動到已驗證過的表單邏輯**——查了 `generic-block-form.tsx` 實際程式碼，`GenericBlockForm` 是自己 `useState` 管理本地 `values`，跟 `onSave` 完全分離。設計成**純附加**：加一個可選的 `onChange` prop，配一個 `useEffect(() => onChange?.(values), [values])`——`setValues`/`update`/`handleSave`/`onSave` 一行都沒改。改完立刻對 `full-bleed`（#1）真實區塊重做一次 enum 欄位存檔往返（`overlayPosition` none→center→none），DB 核對逐字元相符，證明存檔行為真的沒被動到，不需要因此拆成獨立一批。
  2. **media-list 欄位裡「session 中新上傳但清單裡沒有」的邊界情況**——查了資料流：`mediaOptions` 是 `blocks/page.tsx`（Server Component）在頁面載入當下一次查出來、往下傳的 prop；`MediaPicker`/`MediaMultiPicker` 的縮圖網格只能選取這份清單裡已經存在的項目，換句話說**能被選中的 mediaId，必然已經在這份清單裡**——這個邊界情況在目前架構下本來就不會發生，不是靠額外程式碼防守，是資料流本身的結構保證。預覽 iframe 直接沿用同一份 `mediaOptions`（透過 postMessage 一起送過去），不另外在預覽路由重查媒材，天然跟父層同步。
  3. **postMessage 來源驗證與 clickjacking 防護**——`preview-client.tsx` 收訊息時檢查 `event.origin === window.location.origin`；父層送出時也明確帶 `window.location.origin` 當 targetOrigin，不用 `"*"`。查了 `next.config.ts`，`X-Frame-Options: SAMEORIGIN` 已經是全站套用的標頭（SPEC §12.7，Phase 1 就做了），新路由自動涵蓋，不用加新程式碼；CSP 的 `frame-ancestors 'self'` 也已經在 `middleware.ts` 裡（目前 Report-Only，跟 SPEC 既定的 Phase 5 §30 排程一致）。另外確認 `/admin` 底下沒有共用的 `layout.tsx` 做 auth 檢查（`middleware.ts` 註解也明講「/admin 的登入保護...此檔案暫不處理」），所以新的 `/admin/collections/[id]/preview/page.tsx` 跟 `blocks/page.tsx` 一樣自己呼叫 `auth()` + `redirect()`，不是漏掉才補。

  **實作內容**：
  - `src/lib/blocks/preview-message.ts` — postMessage 訊息格式（父層→iframe 的 `PreviewUpdateMessage`、iframe→父層的 `PreviewReadyMessage`）
  - `src/components/blocks/preview/block-preview.tsx` — 12 種區塊的最小渲染元件，刻意只做「結構性預覽」：驗證順序/選圖/文案/大致間距，套用 `theme` 的底色（SPEC §4.3），**不是** Phase 4（§13 項目 21 設計系統）的最終視覺，字體/精確字級/動效都還沒做。Phase 4 動工時要不要沿用這批元件，屆時再判斷。
  - `src/app/admin/collections/[id]/preview/page.tsx` + `preview-client.tsx` — 給 iframe 內嵌用的路由，SSR 撈目前資料庫內容當第一次畫面，掛載後送 `ready` 訊息給父層要最新資料，之後純被動監聽 postMessage 更新，本身不重複打 API
  - `generic-block-form.tsx` 加 `onChange` prop（見上方決策 1）
  - `block-list-client.tsx` 改成兩欄版面（SPEC §7.4 版面圖）、彙整 `liveConfigs`、debounce 300ms 送 postMessage、監聽 iframe 的 `ready` 訊息立刻回送最新資料（用 ref 存最新的 send 函式，避免 `ready` 監聽的 effect 只跑一次而抓到掛載當下的舊 closure）

  **實測中抓到一個真的會讓圖片完全不顯示的 bug**（不是理論推測，瀏覽器截圖直接看得出來）：`MediaBox` 元件內部寫死 `className="relative overflow-hidden ..."`，而 full-bleed 用它的地方又疊加 `absolute inset-0` 想貼滿整個父層——`relative` 跟 `absolute` 是衝突的 `position` 宣告，兩個 class 一起塞進同一個 `className` 字串，最後由 Tailwind 產生的 CSS 在樣式表裡的先後順序決定誰生效（不是看 class 字串裡寫的順序），實測結果是 `relative` 蓋掉 `absolute`，導致容器高度塌陷成 0、圖片完全看不到。修法：`MediaBox` 不再內建任何 `position`，改成每個呼叫端依情境明確指定 `relative`（自己撐開一個 aspect-ratio 容器）或 `absolute inset-0`（貼滿一個已經有高度的父層），兩者不再共存於同一個元素上。修完用瀏覽器截圖＋`getBoundingClientRect()` 核對圖片容器高度從 0 變成正常值、圖片實際可見。

  **驗證結果**：
  - 對 cumedy-night 系列即時預覽實測：full-bleed 圖片正確顯示、`overlayText`/`overlayPosition` 未存檔就即時反映在預覽裡（截圖為證，疊字「LIVE PREVIEW TEST」+ `overlayPosition: center` 出現在預覽，同時查資料庫確認 `blocks` 表完全沒被寫入——證明預覽真的是吃即時 state，不是存檔後查詢）、EN/ZH 切換鈕正常運作（切到 ZH 後預覽文字換成中文文案）、往下捲動可看到 pair / mirror 等其餘區塊也正確渲染
  - console 沒有真正的錯誤（有一批 `unsafe-eval` 的 CSP report-only 訊息，來源是我測試時用的瀏覽器自動化工具本身觸發 `eval`，跟這批程式碼無關；另有一則 Next.js 開發模式的 LCP `priority` 效能建議，屬於錦上添花的優化，不影響功能，這批「結構性預覽」的範圍內不處理）
  - `tsc --noEmit`、`eslint src` 全專案通過
  - 最終核對：cumedy-night 8 筆原始區塊的 `config` JSON 與測試前的 baseline **逐字元相符**（這批全程沒有任何存檔動作碰到區塊資料，核對主要是確認沒有意外副作用）

- **第六批（本次剛完成）：草稿/發布機制（SPEC.md §13 項目 20，Phase 3 最後一項）**

  資料模型延續第五批已拍板的決策：**系列層級快照**。`blocks` 表與現有 12 支 block CRUD server action **完全沒有改動**——正常編輯就是草稿。

  **範圍刻意收窄成兩件事，沒有多做**：
  1. 「發布」server action，把當下 collection 的 blocks 序列化寫入 `collections.publishedSnapshot` + `publishedAt`
  2. Admin 後台顯示「目前是否有未發布的變更」（比對草稿 blocks 與 `publishedSnapshot`）

  **明確沒做的事**（避免滾雪球到 Phase 4）：沒有動前台查詢，沒有生出任何前台頁面——`/work/[slug]` 現在依然完全不存在。「Phase 4 前台要讀 `publishedSnapshot`、`null` 時不能 fallback 去讀即時 blocks 表」這件事只寫進本文件第 6 節當決策備忘，沒有寫任何前台程式碼去驗證它。

  **`visibility` 與「有沒有發布過」是兩條獨立、不互相覆蓋的判斷軸**（跟業主確認過的原則，寫進了 `src/lib/blocks/publish.ts` 的註解裡，供 Phase 4 動工時直接照做）：
  - `collections.visibility`（`draft`/`unlisted`/`public`）決定「該不該出現在列表、能不能被索引」，語意不變
  - `publishedSnapshot` 是否為 `null` 決定「有沒有內容可以顯示」
  - Phase 4 前台查詢邏輯的正確順序：**先過 `visibility` 過濾，通過了才看 `publishedSnapshot` 有沒有內容**，不能顛倒或互相取代。兩個容易踩雷的組合都要各自正確處理，不能假設另一軸的狀態：
    - `visibility=public` 但 `publishedSnapshot=null`（切了公開但沒按發布過）→ 該顯示空頁面或 404，不能意外把草稿 blocks 洩漏出去
    - `visibility=draft` 但 `publishedSnapshot` 有值（發布過後又改回草稿，例如暫時下架）→ 前台仍要被 visibility 擋掉，不能因為快照有內容就繞過 visibility 判斷直接顯示

  **實作內容**：
  - `src/lib/db/schema.ts` — `collections` 加 `publishedSnapshot`（text，JSON 字串，可為 `null`）與 `publishedAt`（timestamp_ms，可為 `null`），migration `drizzle/0003_colorful_millenium_guard.sql`，已對真實 Turso 資料庫跑過 `drizzle-kit migrate`
  - `src/lib/blocks/publish.ts` — `buildSnapshot()`（把 blocks 轉成正規化陣列，每筆 config 都重新過一次該 type 的 Zod schema，不直接信任查出來的 JSON 字串，比照 SPEC §12.5）、`serializeSnapshot()`、`hasUnpublishedChanges()`（`publishedSnapshot` 為 `null` 且草稿也沒有任何區塊時視為「沒有變更」，避免對空系列誤報「請發布」）
  - `blocks/actions.ts` 新增 `publishCollection` server action——`requireAuth()` + 速率限制（沿用既有 `adminWriteRateLimit`）+ Zod 輸入驗證，查出當下 blocks、序列化、寫入 `collections`，`revalidatePath`
  - `blocks/page.tsx` 額外查詢 `publishedSnapshot`/`publishedAt`，SSR 階段用 `hasUnpublishedChanges()` 算好布林值一起傳給 client
  - `block-list-client.tsx` 加一列狀態列：「上次發布：{時間}」或「尚未發布過」+「有未發布的變更」黃色 badge（有變更時才顯示）+「發布」按鈕，按下去呼叫 `publishCollection` 再 `router.refresh()`（拿到發布後最新的 `publishedAt`/`hasUnpublishedChanges`）

  **已知的限制，接受、不在這批處理**：「有未發布的變更」是 SSR 階段算好才傳下來的 prop，只在頁面載入或 `router.refresh()` 時重新計算——單一區塊欄位存檔（`GenericBlockForm.handleSave`）目前不會觸發 `router.refresh()`，所以編輯單一欄位存檔後，這個狀態列不會立刻更新，要等下次整頁重新整理或觸發任何既有的 `router.refresh()` 時機（新增區塊、按發布）才會反映最新狀態。這不是新引入的問題——`block-list-client.tsx` 裡 `items[].config` 本來就有一模一樣的既有 staleness（`handleDelete` 也沒有 `router.refresh()`），這批選擇維持現狀一致、不順便去修，因為「發布」動作本身永遠是查真實資料庫當下狀態，不會受這個顯示層的 staleness 影響而發布錯內容——只有狀態列文字可能暫時沒跟上，不影響正確性。

  **驗證結果（全部針對真實 Turso 資料庫，cumedy-night 系列）**：
  1. 對 cumedy-night 執行一次完整發布：UI 顯示「尚未發布過」+「有未發布的變更」→ 點擊發布 → 顯示「上次發布：2026/9/14 下午12:11:28」，badge 消失。查資料庫確認：`publishedAt` 正確寫入為 `Date` 物件；`publishedSnapshot` 反序列化後 8 筆的 `id`/`type`/`sortOrder` 全部正確，每筆 `config` 跟資料庫裡 blocks 當下的 `config` **逐字元相符**（因為兩邊都是同一個 Zod schema `.parse()` 出來的，key 順序天然一致）
  2. 發布後修改草稿：把 statement #7 的 `size` 從 `small` 改成 `large` 並存檔，重查 `publishedSnapshot` 裡對應那筆的 `config` 仍是 `size:"small"`——快照完全不受草稿變動影響，草稿與已發布版本各自獨立
  3. `hasUnpublishedChanges()` 四種組合全部驗證：發布後改動草稿→ `true`；把草稿改回原值（草稿重新等於已發布內容）→ `false`；從未發布過但有內容（pure-land，`publishedSnapshot=null` 且有 10 筆 blocks）→ `true`；從未發布過且完全沒有內容（空陣列 + `null`）→ `false`
  4. UI 重新整理後正確反映「已發布、已改回原值、無變更」狀態，badge 正確消失
  5. `tsc --noEmit`、`eslint src` 全專案通過
  6. cumedy-night 的 statement #7 最終核對回原始 baseline（`size:"small"`），與其餘 7 筆一併逐字元核對過，唯一的實質資料變動是 `collections.publishedSnapshot`/`publishedAt` 從 `null` 變成有值——這是這批要驗證的功能本身產生的真實結果，不是測試殘留，故意保留不還原（`visibility` 仍是 `draft`，沒有任何前台曝光風險）

  Phase 3（SPEC.md §13 項目 16–20）至此全部完成。

- **第七批（本次剛完成）：發布狀態的樂觀更新 + 途中發現並修掉一個 hydration bug**

  起因：第六批留下一個已知限制——「有未發布的變更」是 SSR 階段算好才傳下來的 prop，單一區塊欄位存檔不會觸發 `router.refresh()`，理論上不會立即反映。這批評估要不要用樂觀更新補。

  **實作**（低成本、沒有牽動既有存檔邏輯，直接做）：
  - `GenericBlockForm` 加 `onSaved?: () => void`——`handleSave` 裡 `onSave` 回傳成功後多呼叫一次，純附加，跟上一批的 `onChange` 是同一種模式（不改 `values`/`onSave`/訊息顯示邏輯本身）
  - `block-list-client.tsx` 把 `hasUnpublishedChanges` 從單純的 prop 改成 `useState`，用跟 `items`/`initialBlocks` 一樣的既有模式（`useEffect` 同步 prop → state）；新增 `handleBlockSaved`，存檔成功時樂觀設成 `true`，不重新序列化比對

  **測試過程中意外抓到一個真的會丟 console 錯誤的 hydration bug**（不是這批要修的東西，但就在同一段 UI 上，測試時直接跑出來）：`「上次發布：{時間}」` 用 `publishedAt.toLocaleString("zh-TW")` 直接在 render 裡算，這個 `Date` 是 Server Component 傳下來的 prop，Next.js 對 client component 也會做一次 SSR——Node 的 ICU 資料跟瀏覽器的 ICU 資料在正中午 12 點附近對「上午/下午」判斷不保證一致，兩次測試（12:11、12:29 都是中午 12 點多）都真的觸發了 React hydration mismatch。修法：日期格式化延到掛載後才在 `useEffect` 裡用瀏覽器自己的 locale 算（新增 `PublishedAtLabel` 元件），SSR 跟第一次 client render 統一先顯示 `null`（一致，不會 mismatch）。修完用 fresh reload + `read_console_messages` 確認錯誤消失。

  **實測中發現一個推翻原本前提的事實**：為了確認樂觀更新真的有作用，先暫時停用 `onSaved?.()` 這一行、直接測試「什麼都不做，只存檔」會發生什麼——結果 badge 在存檔後約 1.4 秒**還是自動變成了 `true`**，全程沒有呼叫任何 `router.refresh()`。這證明 `updateBlockConfig` 原本就有的 `revalidatePath()` 呼叫，在 Next.js 15 的 Server Action 機制下，本來就會自動觸發目前掛載頁面的 Server Component 重新抓資料、重新算 `hasUnpublishedChanges`——不需要手動 `router.refresh()`。第六批寫的「已知限制」前提其實不成立：不是「不會更新」，是「大約 1–1.5 秒後才會自動更新」。

  這個事實讓樂觀更新的效果從「解決一個真正不會更新的問題」變成「把 1.4 秒的延遲縮短成幾乎即時，代價是在『改回跟已發布版本完全相同的值』這種邊界情況下，樂觀的 `true` 會被隨後自動抵達的正確 `false` 蓋掉，產生一次閃爍」——這是一個需要業主判斷值不值得的取捨，不是我能單方面決定的，所以停下來用 `AskUserQuestion` 問了業主。**業主選擇保留樂觀更新**（多數情況下存檔後幾乎立即看到 badge，體驗較好；閃爍只發生在「改回相同值」這種較少見的操作，且閃爍本身不影響最終正確性）。

  **驗證結果**：
  1. 對 cumedy-night 的 statement #7 存檔（`size` small→large），badge 在瀏覽器裡幾乎立即（同一批操作內、無需整頁刷新）顯示「有未發布的變更」，查資料庫確認確實存檔成功
  2. 點擊發布，badge 消失、`publishedAt` 更新；再次存檔（改回原值），badge 正確重新出現
  3. 停用 `onSaved` 做對照實驗：純粹只呼叫 `updateBlockConfig`（不做任何樂觀更新），~1.4 秒後 `hasUnpublishedChanges` 依然自動變成正確值——證實 Next.js Server Action + `revalidatePath` 本身已有自動刷新機制，樂觀更新只是把這段時間縮短
  4. hydration 錯誤修復前後對照：修復前 fresh reload 會在 console 噴出 `Uncaught Error: Hydration failed...`；修復後 fresh reload、以及後續多次 `router.refresh()`（發布動作觸發）都沒有再出現
  5. `tsc --noEmit`、`eslint src` 全專案通過
  6. 最終核對：cumedy-night 8 筆區塊逐字元核對回原始 baseline，且發布後 `publishedSnapshot` 與目前草稿序列化結果一致（乾淨收尾，沒有留下「有未發布變更」的懸而未決狀態）

**Phase 4（前台）— 第一批：共用渲染元件搬遷 + SPEC §5 設計系統**

範圍決策（跟業主確認過）：升級現有的「結構性預覽」元件，不從頭另寫一套——渲染邏輯（資料綁定、`MediaBox` 的 position 修復）已經驗證過，不該丟棄重來。這批只做「元件搬遷 + 定位 + 套設計系統」，不接 `/work/[slug]` 頁面本身（那是下一步）。

**檔案結構（搬遷結果）**：

```
src/components/blocks/
└── render/                          （原本叫 preview/，改成中性命名）
    ├── types.ts                     RenderBlock / RenderMediaOption / RenderTheme
    │                                 （原本定義在 preview-message.ts，搬過來——
    │                                  一個共用渲染元件的形狀不該定義在一個
    │                                  聽起來是 admin 專用的檔案裡）
    ├── fonts.ts                     next/font/google：Inter Tight / Inter / Noto Sans TC
    └── block-render.tsx             BlockRenderer（單一區塊，原 BlockPreviewItem）
                                      CollectionBlocksRender（整頁，原 BlockPreviewPage）
```

`src/lib/blocks/preview-message.ts`（admin iframe 的 postMessage 協定，SPEC §7.4 項目 5）維持原本命名，但 `PreviewTheme`/`PreviewMediaOption`/`PreviewBlock` 現在只是 `render/types.ts` 對應型別的 alias，不是原始定義——這樣 admin 端 `block-list-client.tsx` 完全不用改一行 import。`preview-client.tsx`（iframe 外層容器：postMessage 監聽、SSR 首次載入、EN/ZH 切換鈕）**維持不動**，只換了一行 import + 一個渲染呼叫，改成 import `CollectionBlocksRender`。

**設計系統套用範圍**（SPEC §5，只套在這批共用元件的最外層，不動 `src/app/layout.tsx`、不影響 admin 後台自己的介面）：
- **字體**：`next/font/google` 載入 Inter Tight（display，weight 500–600）、Inter（UI/內文，weight 300–400）、Noto Sans TC（中文，weight 300–500），三個 CSS 變數在 `CollectionBlocksRender` 的最外層套用，中文/英文依 `lang` prop 動態切換 font-family
- **字級**：SPEC §5.2 明確給的直接照搬——Statement large `clamp(2rem,4vw,3.5rem)`、內文 `0.9rem`/`0.95rem`（手機/桌機響應式 class）、UI/Meta `0.62rem`/`0.65rem` + 字距 `0.18em`
- **色彩**：三種 `theme`（dark/light/void）的 `--bg`/`--fg` 改成真正的 CSS custom properties（掛在 wrapper 的 inline style 上），不再是純 JS 物件查表
- **間距**：SPEC §5.3 的 `--space-section`/`--space-block`/`--gutter` 三個 token 都定義成 CSS 變數；`--space-block` 用在區塊間 gap，`--gutter` 用在頁面左右內距；`--space-section` 目前定義了但這層還沒有實際使用位置（沒有「section」概念切分），留給 Phase 4 後續使用

**驗證結果**（cumedy-night，透過 admin iframe 重新視覺確認）：
1. `tsc --noEmit`、`eslint src` 全專案通過
2. 瀏覽器截圖 + `getComputedStyle()` 核對：full-bleed 圖片正確顯示、statement 文字的 `font-family` 實測是 `"Inter Tight", "Inter Tight Fallback"`；切到 ZH 後中文文字的 `font-family` 實測是 `"Noto Sans TC", "Noto Sans TC Fallback"`（中文字實際渲染出來，不是 fallback 字體——事先擔心 `next/font/google` 對 Noto Sans TC 的 `subsets` 選項裡沒有中文專屬子集會不會导致中文顯示不出來，實測證實不影響）
3. wrapper 的 `getComputedStyle()` 核對：`backgroundColor: rgb(10,10,10)`／`color: rgb(232,232,232)`（dark theme 正確）、`gap`/`paddingLeft` 在 iframe 窄版寬度下正確 clamp 到下限值
4. 捲動全部 8 筆區塊（full-bleed、statement、pair、mirror、detail-strip、triptych）逐一截圖確認排版、圖片、文字都正常，沒有版面塌陷或圖片消失
5. 即時預覽的容器邏輯（postMessage、debounce）功能沒有退化：把 statement 的 `size` 改成 `display`（未存檔），預覽字級立即明顯放大，查資料庫確認沒有寫入——證實搬遷後容器邏輯與新元件的資料流仍然正確銜接
6. console 沒有錯誤（含 hydration mismatch 檢查）；伺服器端 log 沒有錯誤（字體載入沒有問題）

**跟預期有落差、需要業主/設計師決策的地方**：
1. **SPEC §5.2 只明確給了 Statement large 一組字級**（`clamp(2rem,4vw,3.5rem)`），small/medium/display 三種 statement 尺寸、full-bleed 疊字（overlayText）的確切字級/字距是這批自己內插出來的（邏輯：不超過系列標題上限 7rem、大致按比例分階），不是 SPEC 白紙黑字定義的數字，設計師可能會想微調。已完整列進 SPEC.md §10.4 待業主確認清單。
   - 更正：上一版這裡誤把 single caption、text-image 內文、divider label 也算進「內插」——重新核對程式碼後這三個其實是直接用 SPEC §5.2 已經明確給的內文（0.9rem/0.95rem）或 UI/Meta（0.62rem/0.65rem）數字，數字本身不是編出來的，只有「哪個文字該歸類成內文還是 UI/Meta」是工程端的判斷（例如 divider label 目前算 UI/Meta），已在 SPEC.md §10.4 一併註明。
2. **lens 區塊已修復**：不再是靜態近似 + 除錯文字，改成真的滑鼠追蹤（`clip-path: circle()` + `onMouseMove`），「跟隨游標」/「固定」這兩個除錯文字已經拿掉。詳見本節下方新增的批次記錄。
3. **SPEC §6 的雙語言同時存在 DOM 機制完全還沒做**——現在的 `Lang` 元件仍然是「依 `lang` prop 二選一渲染」，不是 SPEC §6 說的「兩種語言永遠同時在 DOM 裡，用 CSS opacity/字級切換視覺層級」。這批的範圍明確只到 SPEC §5（設計系統），沒有觸碰 §6（語言系統，SPEC §13 項目 22 是獨立項目）；`/work/[slug]` 動工或做語言系統時，`Lang` 元件需要整個換掉渲染邏輯。

**Phase 4 — 第二批：收掉 lens 的除錯文字尾巴，補上真的滑鼠追蹤**

上一批留下的小尾巴：lens 區塊顯示「跟隨游標」/「固定」兩個除錯用文字，不是 SPEC 定義的內容。範圍判斷：先評估「圓形遮罩真的跟隨滑鼠移動」這個效果複不複雜——結論是不複雜（純 CSS `clip-path` + `onMouseMove` 座標追蹤，不涉及新資料模型），直接做完，不用退而求其次做靜態佔位。

**實作**：新增 `LensBlock` 子元件（`block-render.tsx`），用 `clip-path: circle(半徑px at x y)` 讓上層清晰圖只在游標所在圓形範圍內可見；`onMouseMove` 即時更新座標 state，`onMouseLeave` 時歸位到正中央（`50% 50%`）。`followCursor: false`（SPEC 的「固定」狀態）時不掛滑鼠事件，圓形固定置中，不需要額外文字說明狀態——效果本身就是說明。原本的「跟隨游標」/「固定」`<span>` 文字整個拿掉。

**刻意沒做的部分**：SPEC §3.11 提到「行動裝置上改為固定置中的圓，隨捲動位移」——固定置中這部分自然成立（觸控裝置沒有 `mousemove`，`pos` 永遠是 `null`），但「隨捲動位移」這個額外行為沒有做，留到之後真的有需求再補，避免這個小尾巴的範圍擴大。

**驗證結果**：
1. `tsc --noEmit`、`eslint src` 全專案通過
2. 對 x-venom 系列既有的真實 lens 區塊（#3，`followCursor: true`）測試：用原生事件精確驗證 `clip-path` 計算值——初始（未觸發 mousemove）是 `circle(110px at 50% 50%)`（置中）；派發座標在容器左上角的 `mousemove` 後變成 `circle(110px at 30px 19.4px)`；派發座標在容器右下角的 `mousemove` 後變成 `circle(110px at 338px 187.4px)`，證實座標確實跟著游標位置變動；派發 `mouseout`（`relatedTarget` 在容器外，React 判斷「離開」的原生事件基礎）後正確回到 `circle(110px at 50% 50%)`
   - 過程中一度用原生 `mouseleave` 事件測試「離開歸位」，結果沒有觸發——後來確認 React 的 `onMouseLeave` 是靠原生 `mouseout` + `relatedTarget` 檢查模擬的，不會被原生 `mouseleave` 事件觸發，這是測試腳本本身用錯事件類型，不是元件的 bug，改用 `mouseout` 後行為正確
3. 畫面截圖因為這次測試環境的 iframe 在多輪互動後捲動位置不穩定（疑似跟本 admin session 開啟已久、有其餘 debounce 計時器仍在跑有關，不是這批程式碼造成），沒有拿到肉眼可見的截圖佐證，改以上述 `getComputedStyle()` 數值核對作為驗證依據——三種狀態（置中/跟隨/離開歸位）的數值都精確符合預期，判定為充分證據

**Phase 4 — 第三批：`/work/[slug]` 前台系列內頁**

lens 小尾巴收掉之後才動工，範圍就是 SPEC.md §13 項目 24 的核心部分：公開前台的系列內頁，讀 `publishedSnapshot`、套用既定的 visibility 查詢原則。

**實作內容**：
- `src/lib/blocks/publish.ts` 新增 `parsePublishedSnapshot()`——`JSON.parse` 後先過 `PublishedSnapshotSchema` 驗證陣列形狀，再逐筆用該 `type` 對應的 `BLOCK_CONFIG_SCHEMAS` 重新驗證 `config`，不直接信任存進去的字串（SPEC §12.5，即使是自己系統寫的也要驗證）
- `src/app/work/[slug]/page.tsx`（Server Component，公開頁面，不需要 `requireAuth()`）——查詢邏輯依序：查無此 slug → `notFound()`；`visibility === 'draft'` → `notFound()`（不管有沒有發布過）；`publishedSnapshot === null` → `notFound()`（不 fallback 去讀即時 `blocks` 表）；快照解析失敗（理論上不該發生）→ 一樣 `notFound()`，不對外洩漏內部錯誤細節（SPEC §12.9）
- `src/app/work/[slug]/work-page-client.tsx`——薄薄一層 client wrapper，套用跟 admin iframe 預覽一樣的「EN/ZH 二選一」暫時方案，直接 render 共用的 `CollectionBlocksRender`

**刻意沒做的部分**（不在這批範圍內）：
- SEO metadata（`generateMetadata`、`unlisted` 系列的 `noindex, nofollow`）——SPEC §8.1，屬於 Phase 4 項目 24 的另一部分或 Phase 5 項目 27，這批只處理「顯示對不對」，沒有處理搜尋引擎索引標記
- 頁尾「上一個系列／下一個系列」導覽、內容提示層（`requiresConsent`）——SPEC §4.3 其餘規格項目，都還沒做
- 語言系統（SPEC §6/項目 22）一樣還是二選一渲染，跟 admin iframe 預覽的已知限制一致

**驗證結果**（真實資料庫，四種 visibility × publishedSnapshot 組合）：
1. 三個系列目前都是 `visibility: draft`——`cumedy-night`（有 `publishedSnapshot`）、`pure-land`（`publishedSnapshot: null`）、`x-venom`（`publishedSnapshot: null`）分別 curl 對應網址，**全部回 404**，包含 cumedy-night 雖然有發布過的快照，仍被 `draft` 擋掉——直接驗證了「`visibility=draft` 即使 snapshot 有值仍被擋掉」這條路徑，不用另外造資料
2. 查無此 slug（`/work/does-not-exist`）→ 404
3. 臨時把 `pure-land` 切成 `public`（`publishedSnapshot` 仍是 `null`）→ 404（驗證「`public` 但沒發布過」該擋掉，不是顯示錯誤或洩漏草稿）
4. 臨時把 `cumedy-night` 切成 `public`（已經有 `publishedSnapshot`）→ HTTP 200，瀏覽器截圖確認 8 筆區塊全部正確渲染（pair、mirror、statement、detail-strip 等），EN/ZH 切換鈕正常運作，中文文案正確套用 Noto Sans TC；在真實桌機寬度（非 admin iframe 的 420px 窄版）下，SPEC §5 的 clamp 字級正確依視窗寬度放大，不再卡在窄版下限——這是第一次在非 iframe 的真實版面下驗證這批共用渲染元件
5. 測試完立刻把 `pure-land`、`cumedy-night` 的 `visibility` 都改回 `draft`，curl 再驗一次 cumedy-night 確認回到 404，確保沒有真的留下任何系列處於公開狀態
6. `tsc --noEmit`、`eslint src` 全專案通過；console 沒有錯誤

Phase 4 到這裡：共用渲染元件、設計系統、`/work/[slug]` 系列內頁都完成了。SPEC.md §13 項目 22（語言系統）、24 剩餘部分（首頁、關於頁、內容提示層、SEO）、25（Hero 動效）還沒動工。

**Phase 4 — 第四批：SPEC §6 語言系統**

範圍：把 `Lang` 元件從「依 `lang` prop 二選一渲染」改成 SPEC §6.1 定義的「兩種語言永遠同時存在於 DOM，切換只改變視覺層級」。跟業主確認過的理由：首頁的視覺/動效很可能直接用到雙語切換機制，先把語言系統做對，首頁才不用重工。

**實作內容**：
- `Lang` 元件（`block-render.tsx`）不再接受 `lang` prop，永遠同時渲染 `.lang-en`/`.lang-zh` 兩個 span（哪一個語言的字串是空字串就不渲染那個 span，沒東西可顯示跟語言主從無關）
- `.lang-en`/`.lang-zh` 本身不帶任何視覺樣式，樣式規則搬到 `src/app/globals.css`：`[data-lang="en"] .lang-en { font-size:1em; opacity:1 }`、`[data-lang="en"] .lang-zh { font-size:0.55em; opacity:0.55 }`，`zh` 版本相反——這幾個數字是 SPEC §6.1 原文給的，不是內插的
- `data-lang={lang}` 掛在 `CollectionBlocksRender` 的根容器（唯一新增的屬性），字型仍然依語言固定（英文 Inter/Inter Tight、中文 Noto Sans TC），跟哪個語言目前是主要顯示無關
- 5 個呼叫 `Lang` 的地方（full-bleed 疊字、single caption、statement、text-image、divider label）都移除了 `lang={lang}` 參數；`BlockRenderer`/`CollectionBlocksRender` 的 `lang` prop 本身沒拿掉——`EmptyMediaLabel`、`MediaBox` 的「（未選圖片）」這類系統提示文字刻意不在這次雙語化範圍內（SPEC §6 談的是內容語言，不是除錯/占位用途的 UI 文字），繼續吃 `lang` prop 走單語
- `preview-client.tsx`（admin iframe）、`work-page-client.tsx`（`/work/[slug]`）兩邊完全不用改——它們本來就是把 `lang` state 當 prop 往下傳，現在傳下去的意義從「決定渲染哪個語言」變成「決定 `data-lang` 設什麼」，兩邊的 EN/ZH 切換鈕邏輯原封不動

**驗證範圍**：12 種區塊裡只有 5 種（full-bleed、single、statement、text-image、divider）有文字會經過 `Lang`，其餘 7 種（pair、triptych、mirror、detail-strip、lens、sketch-cluster、spacer）沒有雙語文字可測，只需要確認語言系統改動沒有連帶弄壞它們的渲染。x-venom + cumedy-night 兩個系列原本的區塊組合起來涵蓋 8 種類型（full-bleed、statement、lens、pair、detail-strip、single、mirror、triptych），缺 text-image、divider、spacer、sketch-cluster 4 種——在 cumedy-night 臨時新增這 4 種（text-image/divider 給了實際中英文字內容，才測得到雙語效果），測完全部刪除、`visibility` 改回 `draft`、重新發布讓 `publishedSnapshot` 回到只剩原始 8 筆。

**驗證結果**：
1. admin iframe 預覽（cumedy-night，含全部 12 種類型）：`getComputedStyle()` 精確核對——`data-lang="en"` 時，statement 的 `.lang-en` 是 `opacity:1／fontSize:24px`（Inter Tight），`.lang-zh` 是 `opacity:0.55／fontSize:13.2px`（Noto Sans TC，24×0.55 精確吻合）；切到 `data-lang="zh"` 後兩者精確對調。逐一核對 text-image、divider 新增的臨時區塊，總共 3 對雙語 span（statement、text-image、divider 各一對，因為另一個 statement 跟 full-bleed 疊字原本就是空字串，正確地沒有渲染任何 span）全部依 `data-lang` 正確切換，沒有例外
2. x-venom 系列（含 lens 區塊）：admin iframe 確認 `data-lang` 屬性存在、雙語 span 正確渲染、`.aspect-video`（lens 容器）存在且沒有 console 錯誤——確認語言系統改動跟 lens 的 `clip-path` 互動邏輯沒有互相干擾
3. `/work/cumedy-night`（真實前台頁面，非 admin iframe 巢狀環境）：截圖直接看到雙語同時存在的效果——英文大字在前、中文小字灰階緊接在後；切換語言後畫面清楚對調成中文大字在前、英文小字灰階在後。這是第一次在非 iframe 的真實版面下用肉眼截圖確認這個效果（admin iframe 因為巢狀在另一個 iframe 裡，這次測試環境的螢幕截圖時機好幾次跟實際 DOM 狀態對不上，改用 `getComputedStyle()` 數值驗證；`/work/[slug]` 因為不是巢狀 iframe，截圖就正常同步了）
4. 測試過程中一度因為忘記「發布」動作本身有既有的 UI 顯示延遲（見第三批的已知限制），誤以為發布沒生效——查資料庫確認 `publishedSnapshot` 其實已經正確更新（12 筆，含新的 4 種類型），只是狀態列文字沒有立刻反映，不是新 bug
5. 最終核對：清理完臨時區塊後，cumedy-night 8 筆原始區塊逐字元核對回 baseline，`publishedSnapshot` 重新發布同步成只剩這 8 筆
6. `tsc --noEmit`、`eslint src` 全專案通過，過程中兩個系列全程 console 無錯誤

**Phase 4 — 第五批：首頁**

版面草案先呈給業主確認過（沿用 SPEC.md §4.2 既有規格），業主唯一的修改：**系列列表不帶 statement 摘要段落**，回到 SPEC 原文（封面圖＋英文標題＋年份＋類型），完整可讀的雙語文字段落維持只在 `/work/[slug]` 內頁的 statement 區塊呈現。

**架構決策：把 `Lang` 元件從 `block-render.tsx` 搬到 `src/components/lang.tsx`**——首頁的姓名、bio 也需要同一套雙語機制，`Lang` 本來就不是「區塊渲染專屬」的東西，繼續留在 `blocks/render/` 底下語意不對。`block-render.tsx` 改成從 `@/components/lang` import `Lang`/`langFontClass`/`langFontVariables`，`CollectionBlocksRender` 原本直接寫 `${displayFont.variable} ${uiFont.variable} ${zhFont.variable}` 的地方也改成用 `langFontVariables`——純搬遷，沒有改變任何行為，`tsc`/`eslint` 通過即證明。

**實作內容**：
- `src/app/page.tsx`（Server Component）——查 `profile` 單例、`collections` 依 `visibility === 'public'` 過濾＋`sortOrder` 排序（沿用 `/work/[slug]` 已定案的查詢原則）、`media` 解析封面圖/Hero 圖網址
- `src/app/home-page-client.tsx`——跟 `preview-client.tsx`/`work-page-client.tsx` 同樣的模式：只有這層是 client component（管 `lang` state + `data-lang` + EN/ZH 切換鈕），實際內容用 `children` 從 Server Component 傳進來，不用整頁進 client bundle
- `src/app/home-sections.tsx`——`Hero`／`SeriesList`／`BioSection`／`SiteFooter` 四個 Server Component，對應 SPEC §4.2 的四個區塊。SPEC §5.1：首頁屬於「介面」，固定用 `--ui-black`（`#0A0A0A`）深底＋`--ui-white`（`#F2F3F4`）文字，不套用任何系列的 `theme`（dark/light/void 是系列頁專屬）
- **Hero 圖片 fallback**：`profile.heroImageId` 為 `null` 時退回第一個 `public` 系列的封面圖（SPEC §4.2 原文寫的邏輯），實測環境目前 `heroImageId` 確實是 `null`，這條 fallback 路徑是真的被走到、不是理論上寫好沒測過
- **Hero 進場動效**（`globals.css` 新增三組 `@keyframes`：`hero-line-expand`／`hero-slide-up`／`hero-fade-in`）：水平線 `scaleX(0)→1`（0.8s，`transform-origin:left`，避免用 `width` 動畫觸發 layout）→ 姓名雙語兩行各自 `translateY(100%)+opacity:0 → 0/1`（EN 行 0.8s 開始、ZH 行 0.95s 開始，做出「逐行延遲 0.15s」）→ 輔助資訊（role/location）1.6s 後淡入。全部用 Tailwind 的 `motion-safe:`/`motion-reduce:` variant，不是額外寫 media query——`prefers-reduced-motion` 的使用者完全不會套用 `opacity:0`/`scale-x-0` 這些「動畫前」的隱藏狀態，直接看到最終樣子，不會經歷「動畫沒播放、內容卡在看不見的狀態」這種常見的 reduced-motion 實作錯誤
  - 這裡有個容易忽略的坑：姓名的 `.lang-en`/`.lang-zh` span 本身已經被 `globals.css` 的語言系統規則控制 `opacity`（1 或 0.55，見上一批）——如果進場動效的「淡入」也直接把 `opacity:0→1` 動畫寫在同一個 `.lang-en`/`.lang-zh` 元素上，兩條規則會互相覆蓋，可能讓次要語言那行的 `opacity` 卡在錯的值。修法是動效的 `opacity` 動畫掛在**外層包住 `.lang-en`/`.lang-zh` 的另一個 span** 上，語言系統的 `opacity:0.55` 留在內層——兩層的 opacity 是相乘關係（CSS 繼承的乘法效果），動效播完後外層變回 1，內層仍然依語言主從維持 1 或 0.55，兩者不衝突
- **系列列表**：只在 `visibility === 'public'` 時出現，圖片來自 `collections.coverImageId`（不依賴 `publishedSnapshot`——首頁列表跟系列頁內容是兩件事，系列還沒發布過一樣可以出現在首頁列表上，只要 `visibility` 是 `public`）
- 年份/類型目前三系列都是 `null`（見 §3.2），畫面上正確地整段不顯示，不是顯示空字串或「-」

**驗證結果**：
1. 預設狀態（三系列皆 `draft`，`profile.heroImageId`/`bioEn`/`bioZh`/`email`/`instagram` 皆為 `null`）：截圖確認優雅降級——Hero 沒有背景圖但姓名/角色仍正確雙語顯示，系列列表整段不渲染，bio 區塊整段不渲染，頁尾只剩版權行，沒有任何崩潰或顯示空殼區塊
2. 臨時把 cumedy-night 切成 `public`（沒有重新發布，維持原本的 `publishedSnapshot`）：首頁系列列表正確顯示封面圖＋雙語標題（英文為主「Cumedy Night」＋中文小字灰階「未完待酗」）；Hero 的圖片 fallback 邏輯正確生效，改用 cumedy-night 封面圖當背景
3. EN/ZH 切換鈕在 Hero 跟系列列表同時正確對調（`data-lang` 掛在整頁最外層，一次切換全頁生效）——截圖確認中文模式下「曾昱睿」大字清楚、「Tseng Yu Jui」小字灰階，系列標題同樣對調
4. 測試完立刻把 cumedy-night 的 `visibility` 改回 `draft`
5. `tsc --noEmit`、`eslint src` 全專案通過，全程 console 無錯誤
6. **沒有實測的部分**：`prefers-reduced-motion` 的實際效果——這個瀏覽器測試環境沒有可以模擬這個 OS 層級媒體查詢的工具，邏輯依賴 Tailwind 標準的 `motion-safe:`/`motion-reduce:` variant（業界慣用手法），但沒有真的切換系統設定去肉眼確認

Phase 4 主要頁面（首頁、系列內頁）到這裡都完成了。SPEC.md §13 項目 24 剩餘的關於頁、內容提示層，以及項目 25（Hero 動效已經做了，這裡指其餘可能的收尾）、SEO 都還沒動工。

**Phase 4 — 第六批：Hero 背景輪播 + 精選照後台管理**

這批範圍原本在對話中分成四點（一：輪播本身、二：輪播的暫定圖片來源邏輯、三：跟語言系統的相容性、四：精選照後台管理介面），但因為 session 之間的訊息傳遞出現落差，「一、二、三」實際上一直沒有真的動工——程式碼庫裡完全沒有輪播相關的東西。這批等於是把四點一次做完，不是只做「四」。SPEC.md §4.2 原本只寫 Hero 背景是單張圖，這批追加了輪播規格（已同步進 SPEC.md §4.2）。

**精選照資料模型（業主要求先評估）**：`media.featuredOrder`（整數，可為 `null`）——`null` 代表不是精選照，非空值是它在「自己系列的精選清單」裡的順序（0-based，同系列內遞增，不同系列各自獨立編號，不是全站共用一個排序空間）。

評估過的另一個方案（對應表 `featured_media`，帶 `order` 欄位）沒有採用：一個 nullable 欄位就能同時表達「有沒有被選」跟「順序」，不用多一張表、多一次 join、多一支 migration——這批的需求範圍（一個系列對應一組有序精選照）沒有複雜到需要真正的多對多關聯表。跟前幾批「風險最小、不碰既有結構」的判斷邏輯一致（比照草稿/發布批次選「系列層級快照」而非「逐區塊雙欄位」的理由）。

**MediaMultiPicker 拖曳排序：選了 (b)，升級共用元件，沒有另外做一個新元件**——評估後發現拖曳排序的成本不會超出這批範圍：區塊列表本身（`block-list-client.tsx`）已經有一套 `@dnd-kit` 的拖曳排序模式可以直接參考複用，不需要從頭設計。把 `MediaMultiPicker` 從 `src/app/admin/collections/[id]/blocks/media-picker.tsx` 搬到中性位置 `src/components/admin/media-picker.tsx`（因為現在 Block Editor 跟系列詳情頁兩個不同路由都要用），已選的圖片獨立顯示一排、可以拖曳排序，移除改成縮圖右上角的 × 按鈕（原本是「點擊切換選取/取消」，跟拖曳手勢衝突，改版後點擊圖庫網格是「新增」，不再是「切換」）。這同時解決了 HANDOFF/SPEC §10.4 記錄很久的已知限制，SPEC.md 已同步標記為已解決。

**實作內容**：
- `src/lib/db/schema.ts` 加 `media.featuredOrder`，migration `drizzle/0004_polite_sabretooth.sql`，已對真實 Turso 套用
- `src/components/admin/media-picker.tsx`（原 `blocks/media-picker.tsx` 搬過來）——`MediaMultiPicker` 升級成「已選（可拖曳）+ 圖庫（點擊加入）」兩段式版面，`generic-block-form.tsx`／`block-list-client.tsx` 的 import 路徑跟著改
- `src/lib/media/featured.ts` 的 `getHomeCarouselImages()`——輪播圖片池邏輯（每個 `public` 系列各自判斷精選照或 fallback，見 SPEC §4.2）
- `src/app/admin/collections/actions.ts` 新增 `setFeaturedMedia` server action——`requireAuth()` + rate limit + Zod 驗證，並且防呆檢查傳進來的 `mediaIds` 真的屬於這個系列（不讓人透過竄改請求把別系列的照片標成精選照）
- `src/app/admin/collections/[id]/featured-photos-form.tsx` — 系列詳情頁新增的「精選照（首頁輪播）」區塊，自己的存檔按鈕，跟系列基本資料表單是分開送出的兩件事（跟 Block Editor 每個區塊各自存檔同一種模式）
- `src/app/hero.tsx`（從 `home-sections.tsx` 搬出來，因為需要 `setInterval` 變成 client component）——背景輪播用 `next/image` 疊多張圖、CSS `opacity` 做淡入淡出，文字疊層（姓名/角色/位置 + 三段式進場動效）完全沒有改動，原封不動搬過來
- `src/app/globals.css` 的 Hero keyframes（上一批就加的）沒有動；語言系統的 `.lang-en`/`.lang-zh` CSS 規則也沒有動——這批單純是背景圖片來源從「單張」變成「陣列 + 定時切換」，文字疊層跟語言系統兩塊完全不受影響

**實測中抓到一個真實的 hydration bug**（不是理論推測，console 直接噴出來）：一個系列詳情頁如果同時有多個 `MediaMultiPicker`（例如 `triptych` + `detail-strip` 兩個 `media-list` 欄位都在同一頁），每個各自建立自己的 `<DndContext>`，dnd-kit 內部預設用模組級的全域遞增計數器產生 `aria-describedby` 這類無障礙用的 id——SSR 渲染跟 client hydration 算出來的編號對不上，觸發 React hydration mismatch。這是 Block Editor 上一批只有**一個** `DndContext`（整個區塊列表共用一個）時不會踩到的情境，這批因為每個媒材選擇器都各自一個 `DndContext`，「同一頁有多個 DndContext」的情境才第一次出現。修法：用 React 18 的 `useId()`（專門為 SSR/CSR 一致性設計的 hook）給每個 `DndContext` 一個穩定 `id` prop，取代 dnd-kit 內部的全域計數器——這是 dnd-kit 官方文件建議的 SSR 相容做法。

**驗證結果**（全部針對真實 Turso 資料庫 + 真實瀏覽器）：
1. `tsc --noEmit`、`eslint src` 全專案通過；hydration 修復前後對照：修復前 reload 會在 console 噴出 mismatch 警告，修復後沒有
2. **MediaMultiPicker 升級回歸測試**（cumedy-night 既有的 triptych 區塊 #8）：用原生 `PointerEvent` 序列（`pointerdown`→`pointermove`→`pointerup`）模擬拖曳——新增一張（點擊圖庫）→ 正確附加到已選最後；移除一張（× 按鈕）→ 正確移除；拖曳排序（把第一張拖到第三張位置）→ `arrayMove` 語意正確（其餘依序遞補）；存檔查資料庫確認拖曳後的順序正確落地；再拖回原始順序、存檔，逐字元核對回 baseline
3. **精選照選取 + 拖曳 + 存檔**（cumedy-night）：勾選 4 張（618.jpg／DSC02109.jpeg／DSC02300.jpg／DSC02703.jpg）→ 拖曳把最後一張移到最前面 → 存檔 → 查資料庫確認 `featuredOrder` 精確對應拖曳後的順序（0,1,2,3）
4. **輪播讀取精選照**：臨時把 cumedy-night 切 `public`（沒有動 `publishedSnapshot`，因為首頁輪播讀的是 `media.featuredOrder`，跟系列有沒有發布過是兩件事）→ 首頁 Hero 輪播的 4 張圖片 `r2Key` 精確對應到剛才選的 4 張、順序也精確對應拖曳後的結果
5. **Fallback 邏輯**：把精選照全部清空（點 4 個 × 按鈕）→ 存檔 → 查資料庫確認該系列 `featuredOrder` 全部回到 `null`（0 筆）→ 重新整理首頁 → Hero 輪播正確變成該系列依 `media.sortOrder` 最前 3 張（跟資料庫查出來的「預期 fallback 集合」逐一比對 `r2Key` 完全吻合）
6. 測試完把 cumedy-night 的 `visibility` 改回 `draft`，curl 復驗 `/work/cumedy-night` 確認回到 404；全站 `media.featuredOrder` 確認歸零（0 筆非空值，測試沒有留下殘留的精選照標記在其他系列上）；cumedy-night 8 筆區塊逐字元核對回 baseline
7. **沒有實測的部分**：`prefers-reduced-motion` 對輪播自動播放的實際停用效果——這批延續上一批的已知限制，這個瀏覽器測試環境依然沒有工具可以模擬這個 OS 層級媒體查詢（沒有 DevTools Rendering 面板的存取權限）。有確認 `window.matchMedia('(prefers-reduced-motion: reduce)')` 這個 API 呼叫本身可以正常執行、回傳合理的布林值，邏輯本身（偵測到 reduce 時整個 `setInterval` 不啟動，只靜態顯示第一張）沒有語法或執行期錯誤，但沒有辦法真的切換這個系統偏好去肉眼確認自動播放真的停了。業主如果需要，可以自己在 Chrome DevTools 開 Rendering 面板、勾選「Emulate CSS media feature prefers-reduced-motion」測一次。

**Phase 4 — 第七批：關於頁 + 內容提示層**

這批收到的 prompt 明講「內容提示層」如果 HANDOFF 定義不清楚要先回報理解，不要自己猜範圍——查了才發現這個詞其實**在 SPEC.md 裡定義得很清楚**（§4.3、§12.11：`requiresConsent` 觸發的全螢幕提示層，內容取自 `consentNoteEn`/`consentNoteZh`，「進入」寫入 `sessionStorage`、同一 session 不重複詢問，是內容禮貌機制不是存取控制），只是 HANDOFF 自己前幾批的「下一步」段落只提了這個名詞、沒展開定義，才會讓人誤以為是新概念。這批直接按 SPEC §4.3/§12.11 的既有定義做，沒有另外詢問。

**關於頁最終欄位清單**（SPEC.md §4.4）：
- `profile.nameEn`/`nameZh`/`roleEn`/`roleZh`、`profile.aboutImageId` — 已接資料（姓名/職稱目前有值，`aboutImageId` 目前是 `null`，條件渲染不顯示圖片）
- `profile.bioEn`/`bioZh` — 已接資料，目前是 `null`，區塊整個不渲染（`AboutBio` 回傳 `null`）
- `awards`（依 `sortOrder`）— 已接資料，4 筆全部顯示；`titleEn` 為 `null` 的 3 筆（嶺東時裝週/畢業展/武漢長江盃）**不套用雙語主從機制**，直接顯示中文原文一次（見下方「新踩的坑」）；`resultEn`/`resultZh` 皆為 `null` 的那 1 筆（金點新秀設計獎，證書未載明名次）該行成果直接不渲染，不顯示空白或 `undefined`
- `profile.email`/`instagram`/`behance` — 已接資料，目前全部 `null`，關於頁的聯絡資訊區塊（`ContactSection`）跟頁尾（`SiteFooter`）都各自條件渲染，兩者都不顯示任何殘影
- **金點新秀證書是否公開展示** — 新增 `awards.showCertificate`（boolean，預設 `false`），見下方資料模型說明；目前業主還沒決定，維持不勾選、不顯示

**證書公開展示的資料模型**：新增 `awards.showCertificate`（boolean，not null，預設 `false`），migration `drizzle/0005_premium_flatman.sql`，已對真實 Turso 套用。刻意跟 `awards.imageId`（已存在，這批之前就有）分成兩個獨立欄位，不是「有沒有圖」直接決定「顯不顯示」——SPEC §10.4 原本的顧慮是「證書一旦要公開展示，圖片必須進公開可讀路徑，§12.4『證書不進公開圖片路徑』的考量就不適用」，這代表「後台先把證書存起來備查」跟「業主同意公開」是兩件不同時間點、不同人決定的事，不能綁在一起用圖片存在與否反推。關於頁只有 `showCertificate === true && imageId` 都成立時才顯示證書縮圖。後台 `/admin/awards` 表格新增「證書」欄位的勾選框（`AwardCertificateToggle`），各自獨立存檔（`updateAwardShowCertificate` server action，`requireAuth` + Zod 驗證）。

**架構決策：`LangPageWrapper` 跟 `SiteFooter` 搬到中性位置**——原本只有首頁用得到「`data-lang` + EN/ZH 切換鈕」跟頁尾，這批關於頁變成第二個消費者，比照上一批 `Lang` 元件的搬家理由（「本來就不該綁死在單一頁面底下」），把 `home-page-client.tsx` 整個搬成 `src/components/lang-page-wrapper.tsx`（`HomePageClient` 重新命名成 `LangPageWrapper`），`SiteFooter` 從 `home-sections.tsx` 搬成 `src/components/site-footer.tsx`。首頁 `page.tsx` 的 import 路徑跟著改，行為沒有變動（純搬遷）。

**新踩的坑：`titleEn` 缺值時不能直接塞進雙語 `Lang` 元件**——`Lang` 元件的邏輯是「兩個語言都存在，只是視覺主從不同」，如果 `titleEn` 是 `null` 而把 `titleZh` 同時當 `en`/`zh` 兩個 prop 傳進去頂著，會在畫面上同一個位置出現兩份一模一樣的中文字（一大一小疊在一起），不是規格要的「英文版面 fallback 顯示中文」。修法是寫了一個 `AwardTitle` 小元件：有 `titleEn` 就走正常的 `Lang` 雙語機制，沒有就跳過雙語系統、只用一個 plain span 顯示 `titleZh` 一次（不受 `data-lang` 切換影響，兩種語言模式下都是同一個中文字、同一個字級）。`AwardResult` 處理 `resultEn`/`resultZh` 皆缺值（不渲染整行）用同一個模式。

**實測中抓到一個真實 bug（不是理論推測）**：內容提示層的「返回」按鈕原本寫 `window.history.length > 1 ? router.back() : router.push('/')`，邏輯是「有上一頁歷史就返回，沒有就回首頁」，但用全新分頁直接開系列連結（例如業主之後真的要投遞限定連結時的典型情境）實測後發現：新分頁的瀏覽器歷史本來就會有一筆分頁初始的空白頁，導航到系列頁後 `history.length` 已經是 2，滿足 `> 1`，於是點「返回」會 `router.back()` 到那個空白頁——使用者會卡在一片空白，不是任何有意義的畫面。修法是拿掉這個判斷，「返回」固定 `router.push('/')`，不猜歷史堆疊裡有沒有真的存在有內容的前一頁，比較可靠（付出的代價是犧牲了「回到原本瀏覽到一半的頁面」這個理論上更好、但不可靠的行為）。

**實作內容**：
- `src/lib/db/schema.ts` 加 `awards.showCertificate`，migration `drizzle/0005_premium_flatman.sql`，已對真實 Turso 套用
- `src/app/about/page.tsx` + `src/app/about/about-sections.tsx` — 關於頁 Server Component + 內容區塊（`AboutHeader`/`AboutBio`/`AwardsList`/`ContactSection`）
- `src/components/lang-page-wrapper.tsx`、`src/components/site-footer.tsx` — 從首頁搬出來的共用元件（見上方架構決策）
- `src/app/admin/awards/actions.ts` 新增 `updateAwardShowCertificate`；`award-image-picker.tsx` 新增 `AwardCertificateToggle`；`page.tsx` 表格新增「證書」欄
- `src/app/admin/profile/actions.ts`、`src/app/admin/awards/actions.ts` 的既有 server action 補上 `revalidatePath('/')`/`revalidatePath('/about')`——之前只 revalidate `/admin/...`，理論上首頁的 bio 跟關於頁存檔後會有一段時間顯示舊資料（下次自然重新整理前），這批一併修掉（範圍內的既有小缺口，不是這批引入的新問題）
- `src/app/work/[slug]/page.tsx`、`work-page-client.tsx` — 內容提示層：新增 `requiresConsent`/`consentNoteEn`/`consentNoteZh` 查詢跟傳遞，`ConsentGate` 全螢幕元件，`sessionStorage` 記憶確認狀態（key 為 `consent:${slug}`）

**驗證結果**（全部針對真實 Turso 資料庫 + 真實瀏覽器，用現有三系列/profile/awards 的真實資料狀態測試，沒有另外造假資料——這些欄位本來就大量留空，正好拿來測佔位邏輯）：
1. `/about` 在目前真實資料狀態下（profile 幾乎全空、4 筆 awards 的 `imageId` 全 `null`）截圖確認：姓名/職稱正確顯示、無 bio 區塊、無聯絡資訊區塊、無關於頁圖片、awards 4 筆全部正確（3 筆缺英譯的顯示中文一次不重複、金點新秀那筆正確不顯示成果行）、頁尾只剩版權，無崩潰、無 `undefined` 字樣
2. EN/ZH 切換鈕在關於頁正確運作，`Lang` 雙語主從對調正確，`AwardTitle`/`AwardResult` 的 fallback 邏輯在兩種語言模式下都正確（缺英譯那 3 筆維持同一個中文字級，不受切換影響）
3. 後台 `/admin/awards` 證書勾選框 + 圖片選擇器端到端測試：登入（沿用既有的「直接插入 session 列 + 設 cookie」繞過寄信的測試方式，見 §2.1）→ 給金點新秀那筆選一張圖庫既有圖 → 勾選公開展示 → 重新整理 `/about` → 證書縮圖正確出現在該筆下方 → 測完取消勾選、圖片選回「（無圖片）」、刪除測試用的 session 列 → 查資料庫確認 4 筆 `awards` 完全回到 baseline（`showCertificate` 全 `false`、`imageId` 全 `null`）
4. 內容提示層：臨時把 cumedy-night 切 `public`（沿用既有的「測試完切回 draft」流程）→ 直接訪問 `/work/cumedy-night` 正確顯示全螢幕提示層（中英文提示文字都正確，取自 seed 資料的 `consentNoteZh`/`consentNoteEn`）→ 點「進入」→ 內容正確顯示 → 重新整理同一分頁 → 不重複詢問（`sessionStorage` 生效）→ **新分頁**直接開同一連結 → 正確重新詢問（`sessionStorage` 是分頁層級，不是跨分頁共用，符合規格「同一 session」字面意思）→ 點「返回」→ 正確回首頁（這一步就是上面抓到並修掉的 bug，修復前會卡在空白頁）
5. 測試完把 cumedy-night 的 `visibility` 改回 `draft`，curl 復驗 `/work/cumedy-night` 回到 404
6. `tsc --noEmit`、`eslint .` 全專案通過，全程 console 無錯誤

至此 Phase 4（前台）全部完成——首頁、系列內頁（含內容提示層）、關於頁都做完並實測。Phase 5 只剩 SEO 收尾（§7）還沒動工。

**Phase 5 — 第八批：SEO / AEO / GEO 收尾**

照 HANDOFF §7（本文件既有的規劃清單）落地，沒有重新設計範圍。這批額外做了一件之前批次都沒做過的事：**用 `pnpm build && pnpm start` 跑一次真正的 production build 測試**，不只是 `next dev`——過程中抓到兩個只有在 production 模式才會出現、`next dev` 完全測不出來的真實 bug（見下方），值得記錄成方法論筆記：`next dev` 不會套用 Next.js 的靜態頁面快取/ISR，之前所有批次「切換 visibility 後重新整理立刻看到變化」的驗證，都是在這個「沒有快取」的假象下測的，沒有真的驗證過 production 環境下「存檔後前台多久會更新」這件事。

**`generateMetadata` 涵蓋的路由**：根 layout（`src/app/layout.tsx`，全站預設 title template `%s — Tseng Yu Jui`/`GENERIC_SITE_DESCRIPTION` 保底）、`/`、`/about`、`/work/[slug]`。四個路由都有 title/description/canonical/OpenGraph/Twitter Card；`/work/[slug]` 額外依 SPEC §8.1 公式輸出 `robots`（`unlisted` → `noindex, nofollow`，其餘 `index, follow`；`draft` 在 metadata 產生前就已經 `notFound()`，不會走到這裡）。

**JSON-LD**：首頁跟關於頁都輸出 `Person`（HANDOFF §7.2 對應表，`homeLocation` 選用理由見 `src/lib/seo.ts` 註解），`/work/[slug]` 輸出 `CreativeWork`。**因為 `year`/`category`/`pieceCount` 三個系列目前都是 `null`，JSON-LD 實際上會比對應表規劃的少這三個屬性**：`dateCreated`（來自 `year`）、`genre`（來自 `category`）、`numberOfItems`（來自 `pieceCount`，且這個屬性嚴格來說不屬於 `CreativeWork` 官方 schema，HANDOFF §7.2 本來就標註過這個不精確、這批照舊實作不重新設計）——業主補齊這三個欄位（SPEC §10.3 待補清單裡已經有）之後，這三個屬性會自動出現，不需要再動程式碼。實測 `buildCreativeWorkJsonLd()`/`buildPersonJsonLd()`（`src/lib/seo.ts`）：缺值欄位正確整個不輸出，沒有 `null`/`""` 殘留在 JSON-LD 裡。

**`sitemap.xml`/`llms.txt` 收錄邏輯**：兩者都用同一條判斷——`visibility === 'public'` **且** `publishedSnapshot IS NOT NULL`（跟 `/work/[slug]` 本身的 404 判斷一致，見 `src/lib/collections/get-published-collection.ts`）；只有 `public` 沒 `unlisted`——`unlisted` 語意上是「不公開列出」，llms.txt/sitemap 本身就是「列出」，跟之前 HANDOFF §7.1 的決策一致。`robots.txt` 允許全爬，沒有排除 `/admin`（已有 `requireAuth()` 擋著，不重複防禦；照這批 prompt 明講的「不用特別排除什麼」）。

**實測中抓到三個真實 bug（不是理論推測，全部有具體重現步驟）**：

1. **`/work/[slug]` 的 `<title>` 疊字**：一開始在 `generateMetadata` 裡回傳 `title: \`${row.titleEn} — Tseng Yu Jui\``，但根 layout 的 `template: "%s — Tseng Yu Jui"` 會自動再補一次後綴，疊成 `"Cumedy Night — Tseng Yu Jui — Tseng Yu Jui"`——截圖抓到後改成只回傳 `row.titleEn`，讓 template 自己補後綴一次。

2. **草稿系列的完整內容經由 RSC payload 洩漏到 404 頁面的 HTML 原始碼**（這批最嚴重的一個發現）：為了讓 `generateMetadata` 跟頁面本體共用同一份「visibility + publishedSnapshot」404 判斷（避免 metadata 比頁面本體晚擋、先把草稿標題寫進 `<head>`），把查詢包成 `cache()` 共用函式。第一版圖省事用 `db.select().from(collections)`（整列），結果用 `curl` 直接看 `/work/cumedy-night`（此時 `visibility: draft`）的原始 HTML，發現 React Server Components 的 streaming payload（`self.__next_f.push(...)`）裡完整內嵌了這個草稿系列的 `statementEn`/`statementZh`/`consentNoteEn`/`consentNoteZh`/`publishedSnapshot` 等等——即使頁面本身正確 404、看得到的畫面只有通用 404 文字，view-source 還是能看到全部草稿內容。用 `pnpm build && pnpm start` 復現過（不只是 dev 模式的殘留調試資訊，用實際 production build 確認過）。**修法**：把 `getPublishedCollection()`（`src/lib/collections/get-published-collection.ts`）的查詢改成只選真正會用到的欄位，不再 `select()` 整列——修完之後不管 dev 或 production 模式，`curl` 原始 HTML 都不再出現任何 `statementEn`/`consentNoteZh`/系列標題字樣，只有請求路徑裡的 slug 字串本身（不是敏感資訊）。這個教訓也提醒了一件事：`cache()` 包裝的函式，共用的是「這個 request 內的計算結果」，不是「回傳值以外的中間狀態都安全」，`select()` 整列這種圖方便的寫法在這種被多處共用的查詢函式裡風險比單一用途的查詢更高。

3. **`updateCollection`/`publishCollection` 這兩支既有 server action（在這批之前就存在，不是這批新寫的）沒有 `revalidatePath` 前台路徑**：這是用上面提到的「production build 測試法」才抓到的——`next dev` 完全不會暴露這個問題，因為 dev 模式沒有套用 Next.js 對 `/`、`/about`、`sitemap.xml`、`robots.txt`（都沒有動態訊號，會被判定成可靜態預渲染）的靜態快取。用 `pnpm build && pnpm start` 起一個真正的 production server，透過後台表單把 cumedy-night 切成 `public`（不是直接寫資料庫，是真的點過 admin 表單的「儲存」按鈕）之後，`curl /sitemap.xml`、`curl /llms.txt`、`curl /`（系列列表）**全部還是舊狀態**，因為 `updateCollection`（系列基本資料表單，含 `visibility`）只 revalidate 了 `/admin/collections` 跟 `/admin/collections/${id}`，`publishCollection`（區塊編輯器的「發布」按鈕）只 revalidate 了 `/admin/collections/${id}/blocks`——兩支都完全沒碰前台任何路徑。這代表**業主之前每一批的「切換 visibility 立刻在瀏覽器看到效果」的驗證，全部是在 dev 模式的假象下測的**，正式部署到 Vercel 後，切換 public/發布系列都不會立刻反映在前台，要等下一次重新部署才會更新——這是一個上線後會直接影響業主操作體感的既有缺陷，這批範圍雖然主要是 SEO，但因為新加的 `sitemap.xml`/`llms.txt` 直接依賴這個機制才能正確運作，所以一併修掉，不算超出範圍。**修法**：`updateCollection` 補上 `revalidatePath("/")`/`` revalidatePath(`/work/${values.slug}`) ``/`revalidatePath("/sitemap.xml")`/`revalidatePath("/llms.txt")`；`publishCollection` 用 `.returning({ slug })` 拿到 slug 後補上同樣四個 revalidate。**這個修復是唯二真正端到端驗證過的項目之一**（見下方測試第 4 點）——不是只看程式碼邏輯合理就假設有效，是真的透過 production server + 真實 admin 表單操作 + `curl` 复驗前台結果。

**其他實作內容**：
- `src/lib/seo.ts` — `SITE_URL`/`absoluteUrl()`/`ogImageUrl()`/`truncateDescription()`（155 字，SPEC §8.1）/`GENERIC_SITE_DESCRIPTION`（最後一層 fallback，profile 也沒填時用，不算編造業主內容）/`jsonLdScriptProps()`（`<` 轉義防止 JSON-LD 內容跳脫 `</script>`）/`buildPersonJsonLd()`/`buildCreativeWorkJsonLd()`
- `src/lib/media/resolve-og-image.ts`、`src/lib/profile/get-profile.ts` — `cache()` 包裝的共用查詢，避免同一個 request 內 `generateMetadata` 跟頁面本體查兩次
- `src/app/sitemap.ts`、`src/app/robots.ts`、`src/app/llms.txt/route.ts`（Next.js 支援用字面資料夾名稱當路由，`llms.txt` 這種帶副檔名的路徑也適用）

**測試結果**（`tsc --noEmit`/`eslint .` 全專案通過；**這批第一次同時用 `next dev` 跟 `pnpm build && pnpm start` 兩種模式測試**，之前批次都只測過 dev 模式）：
1. Dev 模式：`/`、`/about` 的 title/description/canonical/OG/JSON-LD 截圖+程式化讀取 `<head>` 逐欄位核對，缺值（profile 幾乎全空）正確 fallback 到 `GENERIC_SITE_DESCRIPTION`、JSON-LD 正確只剩 `name`/`alternateName`/`jobTitle`/`url` 四個欄位
2. 臨時把 cumedy-night 切 `public`：`/work/cumedy-night` 的 title 正確（無疊字）、description 精確 155 字截斷、JSON-LD `CreativeWork` 正確、consent gate 沒有被這批的改動影響（新分頁重新詢問、同分頁不重複詢問都還正常）；切 `unlisted` 後 `robots` 正確變成 `noindex, nofollow`；`sitemap.xml`/`llms.txt` 正確收錄／排除（`unlisted` 不進兩者）
3. 切回 `draft`：`curl` 原始 HTML 確認無 bug 2 描述的洩漏（用 `pnpm build && pnpm start` 復現跟驗證修復，見上方）
4. **`revalidatePath` 修復的端到端驗證**：`pnpm build && pnpm start` 起 production server → 用「直接插入 session 列 + 設 cookie」的方式登入（見 §2.1）→ 在 `/admin/collections/[id]` 表單把 visibility 改成 `public`、點「儲存」→ **不重啟、不重新部署**，直接 `curl /sitemap.xml`/`curl /llms.txt`/`curl /` 確認 cumedy-night 立刻出現 → 同一個 production server 上再把 visibility 改回 `draft`、儲存 → 再次 `curl` 確認立刻消失、`/work/cumedy-night` 回到 404
5. 測試完刪除測試用的 session 列，`tsx` 腳本查資料庫確認 `collections`（3 筆全 `draft`）、`awards`（4 筆 `showCertificate` 全 `false`、`imageId` 全 `null`）都精確回到這批開始前的 baseline

**環境變數提醒**：`NEXT_PUBLIC_SITE_URL` 這批為了能測試 OG/canonical/sitemap 網址，在**本機** `.env.local` 填了 `http://localhost:3050`——這只是本機開發用，**Vercel 上的 Production/Preview 環境變數仍然是空的**（見 §2.1），正式上線前一定要填真實網域，不然 sitemap/JSON-LD/OG 網址會是本機網址或相對路徑。

**Phase 5 — 第九批：全專案「select 整列」排查**（第八批 bug 2 的後續，同一天）

第八批抓到的洩漏（`getPublishedCollection()` 用 `db.select().from(collections)` 選整列，經由 `cache()` 共用查詢把草稿系列的 `statementEn`/`consentNoteEn/Zh` 洩漏進 404 頁面的 RSC payload）被指出可能是「系統性風險模式」，這批對整個專案做了一次排查，範圍：**所有會被公開路由（非 `/admin` 底下、沒有 `requireAuth()` 保護）用到的資料庫查詢函式**。

**排查方法**：`grep` 出全專案每一個 `db.select(` 呼叫點，逐一分類是否落在公開路由可達的程式碼路徑（`src/app/page.tsx`、`src/app/about/page.tsx`、`src/app/work/[slug]/page.tsx`、`src/app/sitemap.ts`、`src/app/robots.ts`、`src/app/llms.txt/route.ts`，以及這些頁面會呼叫到的 `src/lib/**` 共用函式），確認每一筆呼叫是否明確列欄位、是否有不必要的大範圍列掃描。`/admin` 底下的查詢（`awards`/`media`/`blocks` 的後台頁面與 server action）逐一確認過沒有被公開路由共用同一支函式，照指示不比照公開路由標準去改。

**發現的問題（4 處，同一種模式的不同表現形式，全部已修）**：

1. `src/lib/collections/get-published-collection.ts`——第八批已修的原始洩漏，這批複查確認修復仍然正確（見上方第八批記錄）。
2. `src/lib/profile/get-profile.ts`——**跟原始洩漏結構上完全一樣**：`cache()` 包裝、`db.select().from(profile)` 選整列、被首頁/關於頁的 `generateMetadata` 跟頁面本體共用同一個 promise。`profile` 目前沒有 draft/consent 這種需要隱藏的欄位，所以今天沒有實際外洩後果（每個欄位都是「有值就打算公開」的內容）——但這批判斷不該依賴「今天沒有敏感欄位」這個事實去決定要不要收斂：日後這張表如果加一個不該公開的欄位，不會有人想到要回來重新檢查這支函式。已改成明確列欄位（除了 `id`、`updatedAt` 沒有任何消費端用到，其餘欄位其實幾乎全部都被某個公開頁面用到，收斂空間不大，但欄位範圍變成顯式、不會再自動帶出新欄位）。
3. `src/app/about/page.tsx` 的 `awards` 查詢——不是 `cache()` 共用（單一 Server Component 內一次性 await），**實測過不會有第八批那種洩漏機制**（見下方測試第 1 點的對照實驗）。但 `imageId`/`showCertificate` 本來就是「業主決定要不要公開證書」的把關欄位，一樣改成明確列欄位，不留下日後被誤用的範圍。
4. **兩處「欄位選得夠窄、但列（row）沒有限定範圍」的變體**：`src/app/page.tsx`（首頁）跟 `src/app/about/page.tsx`（關於頁）原本都用 `db.select({id, r2Key}).from(media)`（沒有 `where`），會把**全站所有系列（含草稿）的 media 的 `r2Key`／`filename` 都撈出來**——欄位本身選得窄，但列的範圍沒有收斂，一樣是「圖方便」的變體。`src/app/work/[slug]/page.tsx` 也有同樣寫法，且更嚴重：`/work/[slug]` 完全沒有限定 `collectionId`，會撈出「其他系列」的 media。三處都改成只查真正需要的 media id：首頁/關於頁明確列出需要的 id 陣列（封面圖、Hero fallback 圖、關於頁圖、證書圖）；`/work/[slug]` 新寫了 `extractMediaIds()`（`src/lib/blocks/publish.ts`，鴨子型別掃描 12 種區塊 schema 的 4 種 media 欄位名稱：`mediaId`/`leftMediaId`/`rightMediaId`/`mediaIds`），只查快照裡真正引用到的 media。

**JSON-LD 產生邏輯本身有沒有序列化 `consentNoteEn`/`consentNoteZh`**：確認沒有。`buildPersonJsonLd()`/`buildCreativeWorkJsonLd()`（`src/lib/seo.ts`）的輸入型別（`PersonJsonLdInput`/`CreativeWorkJsonLdInput`）本身就沒有 consent 相關欄位，結構上不可能誤傳——`grep consentNote` 全專案，這兩個欄位只出現在 `work-page-client.tsx`（consent gate 本身要用，是正確用途），沒有出現在 `src/lib/seo.ts` 或任何 JSON-LD 呼叫點。

**Admin 端確認過的既有相同模式（風險層級不同，照指示沒有改）**：`src/app/admin/collections/[id]/preview/page.tsx`、`src/app/admin/collections/[id]/blocks/page.tsx` 也有同樣「`db.select({...}).from(media)` 沒有 `where`」的寫法——但這兩支各自獨立、沒有被任何公開路由呼叫，是後台 iframe 預覽跟 Block Editor 自己的查詢，有 `requireAuth()` 擋著，照這批指示的範圍界定不動。

**測試結果**：
1. **對照實驗**（確認洩漏機制的邊界，不只是複查第八批的修復）：在收斂 `about/page.tsx` 的 `media` 查詢之前，先用 `pnpm build && pnpm start` + `curl /about` 測過「未收斂、非 `cache()` 共用」的版本——結果**沒有**在原始 HTML 裡找到任何草稿系列的 slug 字串。這確認了第八批的洩漏機制確實是 `cache()` 多處共用促成的（React Server Components 把共用 promise 的完整解析值序列化進 streaming payload），不是「任何一次 `db.select()` 沒收斂欄位/列就會外洩」這麼寬的結論——但這批仍然選擇收斂所有找到的案例，理由是防禦性：不依賴這個實測邊界去判斷未來的程式碼安不安全，測出來的是「今天這個 Next.js 版本、這個資料狀態」下的結果，不是永久保證。
2. **修復後全面 curl 復驗**：`pnpm build && pnpm start`，臨時把 cumedy-night 切回 `draft`（第八批測試結束後的狀態）→ `curl /`、`curl /about`、`curl /work/cumedy-night` 三個頁面的原始 HTML，逐一搜尋 `cumedy-night`/`pure-land`/`x-venom`/`consentNote`/`statementEn` 等字樣，全部 0 筆命中
3. **收斂後的渲染正確性回歸測試**（改完不能只驗證「沒洩漏」，還要驗證「該顯示的還是有顯示」）：臨時把 cumedy-night 切回 `public`，用 `next dev`（不是 production，這步只需要驗證渲染邏輯，跟快取層無關）逐一截圖/讀取 `/`（系列列表封面圖正確顯示）、`/work/cumedy-night`（8 個區塊的圖片全部正確載入，用 `document.images` 逐一確認 `complete: true`）、`/about`（4 筆 awards 正確顯示）——確認 `neededMediaIds`/`extractMediaIds` 收斂後沒有漏查任何實際會用到的圖
4. 測試完把 cumedy-night 切回 `draft`，`curl` 復驗 404；`tsx` 腳本查資料庫確認 `collections`（3 筆全 `draft`）、測試用 session 列（0 筆）都回到 baseline
5. `tsc --noEmit`、`eslint .` 全專案通過

**結論：已排查全專案，公開路由可達的查詢函式裡，除了上面列的 4 處（1 處第八批已修、3 處這批新修），沒有發現其他「select 整列」或「列範圍未收斂」的案例。** Admin 端另外還有 2 處相同模式但風險層級不同（見上方），照指示保留原樣。

**Phase 5 — 第十批：正式建立 git 歷史、GitHub、Vercel 上線**

這批之前專案完全沒有 git 歷史（`git log` 顯示 "No commits yet"）。做了三件事：

1. **git 歷史**：依 HANDOFF 本文件既有的 phase/批次分類，把現有檔案（都是最終狀態，沒有真正的逐批次差異快照）組成 9 個邏輯分明的 commit（scaffold → Phase 1 資料庫/認證/上傳 → Phase 2 後台核心 → Phase 3 Block Editor → Phase 4 共用渲染/語言系統/系列頁 → 首頁+Hero輪播 → 關於頁 → SEO/AEO/GEO+安全排查 → 文件）。**誠實揭露**：這是「依主題整理」不是「逐批次真實重現」——沒有保留每個批次當下的中間版本，被多個批次改過的檔案（例如 `schema.ts`）在它第一次出現的 commit 裡就已經是最終內容，不是逐步演進的快照。之後每個新批次（含這批自己）都會是真正的獨立 commit。
2. **GitHub**：新建 **private** repo `sh940203/tsengyujui-portfolio`（SPEC §12.10 明確要求 private），9 個 commit 一次推上去。
3. **Vercel**：`vercel link` 建立新專案並自動接上 GitHub repo（之後 push 到 `main` 會自動觸發 production 部署，已用第十一批的兩次 push 實測確認）。Production 環境變數全部設定：`TURSO_*`/`R2_*`/`UPSTASH_*` 沿用 `.env.local` 既有的真實憑證（早就在用、已實測過），`ALLOWED_LOGIN_EMAILS` 沿用業主信箱，`AUTH_SECRET` 現場產生一組新的（不沿用本機開發那組，SPEC §1.2 明講每個 Vercel 環境要各自獨立產生），`NEXT_PUBLIC_SITE_URL`/`AUTH_URL` 設成 Vercel 配的預設網域 `https://tsengyujui-portfolio.vercel.app`（部署後才知道真實網址，先用專案名稱猜的模式，部署完 curl 復驗確認猜對）。

**上線網址：https://tsengyujui-portfolio.vercel.app**（首頁/關於頁/sitemap.xml/robots.txt/llms.txt 都 curl 復驗過 200）。

**還沒做、明確記錄的缺口**：
- **`EMAIL_SERVER`/`EMAIL_FROM` 沒有設定**——這兩個值需要業主提供真實 SMTP 憑證，不是工程端能自己決定或編造的，Production 環境目前這兩個變數是空的。這代表 Magic Link 登入在正式站上**還不能用**，公開瀏覽（首頁/系列頁/關於頁）不受影響，只有 `/admin` 登入流程受阻。
- **Preview 環境變數沒有設完整**——`vercel env add <name> preview --value <value> --yes` 這個 CLI 指令組合在目前的 Vercel CLI 版本（54.14.0）對「套用到所有 Preview 分支」這個選項一直回傳 `action_required`/`git_branch_required` 錯誤，不管照官方提示的哪種指令格式都一樣，看起來是這版 CLI 的已知問題。Production 的部署跟環境變數都正常，只有 Preview（PR/非 main 分支的部署預覽）目前沒有任何環境變數，業主如果之後需要用 Preview 部署，需要自己到 Vercel dashboard 手動加（介面操作，不受這個 CLI bug 影響）。
- **Preview 環境沒有獨立的 Turso/R2**——SPEC §1.2 建議 Preview 用獨立的 database 跟 bucket，避免測試資料污染正式內容；這批 Production 用了真實憑證，但沒有另外開一組給 Preview（需要額外的 Turso/Cloudflare 帳戶操作，不在這批範圍內）。等 Preview 環境變數補上時，這點也要一併考慮。

**Phase 5 — 第十一批：無障礙（SPEC §13 項目 28）+ 效能（項目 29）稽核**

用 Lighthouse CLI（`npx lighthouse`）**針對正式上線的 production 網址**測（不是本機 `next dev`——這批之前才確認過 dev 模式測不出快取相關的問題，這裡延續同樣的「測真正會上線的東西」原則）。

**起始分數**（首頁）：Performance 95 / Accessibility 92 / Best Practices 96 / SEO 100。

**抓到並修掉的問題**：

1. **`media.altEn`/`altZh` 資料庫欄位跟後台上傳表單早就有，但共用渲染元件從沒接過**——每張公開的作品照片（這個網站的核心內容）alt 文字實際上是 `filename`（例如 `"DSC02109.jpeg"`）或空字串，對螢幕閱讀器使用者完全沒有意義。改成 `RenderMediaOption` 型別加上 `altEn`/`altZh`，`MediaBox`/`LensBlock` 依目前語言模式挑對應語言（缺該語言 fallback 另一語言），13 處呼叫點跟 3 個資料來源（`/work/[slug]`、admin 預覽、Block Editor 即時預覽的 postMessage）都串起來，TypeScript 型別系統直接幫忙抓出漏改的呼叫點。**目前資料庫 85 筆 media 全部沒有填 alt 文字**——這是需要業主或設計師實際描述每張照片內容的工作，工程端不會、也不該編造，後台編輯介面（`/admin/media`）本來就有欄位，只是從沒有人填過。
2. **首頁跟 `/work/[slug]` 都沒有 `<h1>`**——首頁姓名原本是 `<div>`，改成 `<h1>`；區塊系統本身沒有固定的「標題」欄位（系列頁面完全由設計師自由編排 12 種區塊組成），所以在共用渲染元件裡加一個視覺隱藏（`sr-only`）的 `<h1>`（系列標題），不會蓋過設計師自己排出來的視覺標題。
3. **全站沒有 `<main>` landmark**（Lighthouse `landmark-one-main`）——首頁、關於頁、`/work/[slug]` 的共用渲染元件都補上。
4. **對比度**：實測算出兩個明確不過 WCAG AA 的（不是憑感覺調）——頁尾文字 `#6B6B6B` on `#0A0A0A` 只有 3.72:1，改成 `#808080`（5.01:1）；`「（未選圖片）」`/`「（尚未選圖片）」`佔位文字 `opacity-40` 在 dark/void 主題只有 ~3.3:1，改成 `opacity-60`（沿用 divider 已經在用的同一個值）。
5. **`opacity-* 包住 <Lang> 元件會跟語言系統自己的 0.55 opacity 疊乘」**——這是第一輪修完重新測（見下方）才在關於頁抓到的、比較隱蔽的一個：`AboutHeader` 的職稱文字、`AwardResult`、`single` 區塊的圖說、`divider` 區塊的標籤，都用 `opacity-60`/`70` 包住 `<Lang>` 想做「次要文字」的視覺層級，但次要語言那個 span 本來就已經有 `.lang-zh`/`.lang-en` 的 0.55 opacity（SPEC §6.1 原文數字），兩層疊乘（例如 0.7×0.55≈0.39）讓次要語言幾乎看不見，實測對比度只剩 3.33:1。這跟 HANDOFF 記錄過的「Lang 元件 opacity 與 Hero 動效 opacity 疊加互相蓋掉」是同一類問題在不同地方復發。**修法是拿掉包住 `<Lang>` 的那層 opacity，不是去動 0.55**（0.55 是 SPEC 給的數字，不是工程端的預設值，這批沒有權限去改，這點延續前幾批「SPEC 明講的數字不擅自覆蓋」的原則）；`divider` 的裝飾用橫線改成各自套 `opacity-60`（線不是文字，WCAG 對比不適用），標籤文字本身不再被包進去。
6. **沒有動、明確標記給業主的一個殘留風險**：語言系統的 `.lang-zh`/`.lang-en` 次要語言 0.55 opacity 這個數字本身，在 `theme: light` 的系列上、UI/Meta 級距的小字（0.62–0.65rem）算出來只有 4.05:1，沒有過 AA 的 4.5:1——這是 SPEC §6.1 原文數字造成的，不是工程端可以自己決定要不要改的東西。**目前三個系列都沒有用 `light` 主題**（都是 `dark`），這個問題現在是潛伏的、沒有實際影響，但 `light` 是後台可選的合法選項，业主或設計師如果之後挑了 `light` 主題就會踩到。SPEC.md §10.4 待業主確認清單已經有記錄這個問題（跟上一批「內容提示層持久化範圍」用同樣的措辭風格寫的）。

**修完重新部署、重新測的分數**：
- 首頁：Performance 94 / **Accessibility 100**（92→100）/ Best Practices 96 / SEO 100
- 關於頁第一輪：Accessibility 95，還有 1 個 `color-contrast` 失敗（就是上面第 5 點抓到的疊乘問題）——第二輪修完後同一批重新測，色彩對比失敗清單裡確認已經消失。

兩批都遠遠超過 SPEC §9.3 的目標（Performance ≥90、Accessibility ≥95）。Performance 剩下的扣分項（`unused-css-rules`/`unused-javascript`/`render-blocking-insight`/`network-dependency-tree` 等）是 Next.js/Tailwind/next/font 框架層級的一般性指標，沒有具體到「這裡有個可以馬上修的東西」，這批沒有繼續往下挖；`inspector-issues`（Content Security Policy）是 CSP 目前刻意維持 Report-Only 模式的預期副作用，SPEC §12.12 上線前檢查清單本來就把「CSP 無誤報後改強制模式」列成獨立的上線前步驟，不是這批要處理的。

**Phase 5 — 第十二批：三系列切公開、SPEC §10.4 收尾、Vercel Preview env 再嘗試（2026-09-15）**

業主直接下指示要處理 §5「待業主確認清單」的所有項目，這批一次做完：

1. **三個系列 `visibility` 全部切成 `public`**——`pure-land`/`x-venom` 從未發布過（`publishedSnapshot` 原本是 `null`），切之前先用既有的 `buildSnapshot()`/`serializeSnapshot()`（`src/lib/blocks/publish.ts`，跟後台「發布」按鈕同一套邏輯）把兩者目前的草稿 blocks（10 筆／7 筆）發布成快照，再把三個系列的 `visibility` 一起改成 `public`；`cumedy-night` 已經有發布過的快照且跟草稿一致，只改 `visibility`，沒有重新發布。三個系列都是直接對 Turso 生產資料庫操作（跟本機 `.env.local` 用同一顆資料庫）。本機 `pnpm dev` 立刻反映（`curl` 復驗 `/work/cumedy-night`/`/work/pure-land`/`/work/x-venom` 皆回 200，瀏覽器截圖確認首頁系列列表、三個系列頁都正確渲染）；**但正式站 vercel.app 目前只有 `/work/[slug]` 立刻反映（動態渲染），首頁跟 `sitemap.xml` 仍是舊的靜態快照**——這是直接寫 DB、沒有觸發任何 `revalidatePath` 的預期結果（跟第八批 bug 3 同一個成因），要等下一次真正 `git push` 觸發的部署才會一起更新，詳見上方第 1 節的說明段落。**注意：這批只是「切公開」，Cumedy Night 的 blocks 內容還是原本 seed 時期用少數幾張佔位圖片的版本，見下方第 3 點——業主之後在後台重新編排完，記得要再按一次「發布」，快照才會更新。**
2. **金點新秀設計獎證書公開展示**——業主決定要公開（AskUserQuestion 詢問後的選擇）。證書圖（`服飾設計/獎狀/金點新秀設計獎.jpg`）**沒有**走前台自動化的 `MediaMultiPicker`/admin UI 手動點擊，而是寫一支一次性腳本直接呼叫後台上傳流程背後同一套 pipeline（`generateAndUploadVariants()`，`src/lib/media/generate-variants.ts`）——理由：Auth.js Magic Link 在正式站還不能用（見 §1.1 第十批已知缺口），本機也沒有走過完整的信箱登入流程去點後台的拖拉上傳，直接呼叫底層 pipeline 函式能保證跟 UI 上傳走的是同一段程式碼、同一套 sharp 變體生成／R2 兩個 bucket／EXIF 清除邏輯，不是另外發明一條路徑。上傳後的 media 列（`kind: misc`、`collectionId: null`，跟一般後台上傳的預設值一致）直接寫入該筆 award 的 `imageId`，同時把 `showCertificate` 設成 `true`。瀏覽器截圖確認 `/about` 頁面證書縮圖正確顯示（含簽名與官印，業主已經知情這代表的意義——SPEC §10.4 原文就有講清楚公開展示的後果）。
3. **內容提示層持久化範圍**——AskUserQuestion 詢問業主，選擇**維持現狀**（每次開新分頁或重新造訪都要再按一次進入），不是「同意一次就不用再看到」。沒有程式碼改動。SPEC.md §10.4 對應項目已標記為已確認。
4. **淺色主題次要語言對比度**——這項沒有另外詢問業主（SPEC 原文自己就提出了兩個選項，選其中風險更低、對現有頁面零副作用的那個直接做掉）：`theme: light` 系列的 `.lang-en`/`.lang-zh` 次要語言透明度另外給 `0.65`（原本全站統一 `0.55`，`dark`/`void` 主題與首頁/關於頁不受影響，繼續用規格書原文的 `0.55`）。實作：`CollectionBlocksRender` 的 `<main>` 新增 `data-theme={theme}` 屬性（`src/components/blocks/render/block-render.tsx`），`globals.css` 加 `[data-theme="light"][data-lang=...] .lang-*` 覆寫規則。**沒有肉眼實測**——目前三個系列都還是 `dark` 主題，沒有實際頁面在用 `light`，這個修復目前是「鋪好但沒有實地驗證過視覺」的狀態，`tsc`/`eslint` 通過，CSS 特異性數過一遍確認新規則的選擇器數量足以覆蓋原本的規則。之後如果有系列真的選用 `light` 主題，建議用 Lighthouse 或 DevTools 對比度工具實測一次。
5. **statement 區塊暫定字級**——業主指示可以推進、沒有提供新數字，維持工程端上一批（Phase 4 第一批）內插的既有值不變，SPEC.md §10.4 對應項目標記為維持現值（不是「業主已核准這些精確數字」，只是「沒有更好的資訊，先不擋著，之後單純是改常數」）。
6. **Cumedy Night 成品照精選（33 張收斂到 8–12 張）**——業主選擇自己去後台 Block Editor 挑選編排，這批**沒有**代為決定要用哪幾張、也沒有改動任何 blocks。SPEC.md §10.4 已更新標記為「業主自行處理」。
7. **Vercel Preview 環境變數——CLI bug 復現，仍未解決**：這批重新嘗試 `vercel env add <name> preview --value <value> --yes`（HANDOFF 第十批記錄過的失敗指令），Vercel CLI 54.14.0 回傳的 `action_required`/`git_branch_required` 錯誤訊息本身建議的下一步指令，逐字照做後**遞迴指回同一個指令**，換句話說 CLI 給的「修復建議」本身就是造成錯誤的那個指令，確認不是操作方式的問題，是這版 CLI 真的壞了（用 `--value` 直接傳值、改用 stdin 管道兩種方式都復現同樣結果）。試過 `--force` 這個選項，但這個動作被系統的自動模式分類器擋下（歸類成「Secret-Store Writes」風險操作，需要更明確的授權），沒有繼續嘗試更激進的繞過方式，改成準備好所有變數值跟操作步驟，請業主自己到 Vercel Dashboard 手動點過一次（步驟見這次對話的回覆，不重複寫進本文件——都是操作指引，不是專案決策或程式碼變更，不算這份文件要記錄的範疇）。順便產生了一組全新的 `AUTH_SECRET`（openssl 亂數，只給 Preview 環境用，沒有沿用 Production 或本機那組，符合 SPEC §1.2「三個環境務必各自獨立」的規則）。
8. **EMAIL_SERVER/EMAIL_FROM 設定方式**——這批只在對話中直接教學（SMTP 憑證怎麼取得、`EMAIL_SERVER` 連線字串格式），沒有實際去申請或設定任何服務，因為要用哪家 SMTP 供應商、寄件位址網域是業主自己的決定，不是工程端能代辦的部分。

**測試方法**：全部針對本機 `pnpm dev`（`localhost:3050`，接的是同一顆生產 Turso 資料庫）截圖驗證；`tsc --noEmit`、`eslint src` 全專案通過；`git status` 確認只有 `src/app/globals.css`、`src/components/blocks/render/block-render.tsx` 兩個檔案異動（加上這次的 SPEC.md/HANDOFF.md 文件更新），沒有動到其他既有邏輯。**這批完全沒有 `git push`**——業主要求先在本機看過所有結果，本人同意後才推上 GitHub（會觸發 Vercel 重新部署）。

**Phase 6 — UI/UX 精修批次（2026-09-16 ～ 09-22；第 1–17 項全部已 commit 並 push，見 `git log`；每項的驗證細節與尚未肉眼確認的部分都寫在各項裡）**

業主要求前後台一起雕琢 UI/UX，這批橫跨好幾個對話回合累積而成，統一在這裡記錄。**全程沒有 push**，本機驗證完就等業主看過決定。

1. **UI/UX 稽核抓到兩個真實 bug，已修**：
   - 首頁系列列表的雙語標題窄螢幕換行時，中文緊貼在英文最後一個字後面讀不清楚（例如「Land在最後的淨土上孤獨」）——`.series-title-lang` 範圍內加 `margin-left`，不動 `Lang` 元件全站預設樣式
   - EN/ZH 語言切換鈕觸控範圍只有 32×25px，全站使用頻率最高的元件卻不好按——改成 `min-h-11 min-w-11`（44×44px）。順便發現這顆按鈕被複製貼上了三份（首頁/關於頁、系列頁、admin 預覽各一份），抽成共用元件 `src/components/lang-switch-button.tsx`（`SWITCH_BUTTON_BASE_CLASS` 給後續 `ThemeSwitchButton` 共用同一顆按鈕視覺基底）

2. **圖片顯示：`cover` 改預設 `contain`**——業主指出照片被固定長寬比框架裁切，看不到服裝完整效果。`MediaBox`（`block-render.tsx`）新增 `fit` 參數，預設 `contain`。**刻意保留 `cover` 當例外的三種區塊**（改了反而會壞掉，不是全部一視同仁）：`full-bleed`（語意是滿版出血，不裁切就不貼齊邊緣）、`mirror`（兩張鏡射要精確填滿正方形才能在中線接合）、`lens`（清晰圓圈跟暗化背景要疊在同一個框裡對齊）。首頁系列列表縮圖維持 `cover`（導覽用索引縮圖，不是作品完整呈現的地方）。

3. **全站新增導航（`src/components/site-nav.tsx`）**——UI/UX 稽核抓到全站真的沒有任何導航（沒 `<nav>`、頁尾只有 email/IG、系列頁之間也沒有上一個/下一個）：
   - 左上角固定 `SiteNav`，跟右上角語言切換鈕對稱：首頁顯示 WORK（錨點捲動到 `#series`）/ BIO（錨點捲動到 `#bio`）/ ABOUT（換頁去 `/about`）；系列頁顯示 INDEX / ABOUT；關於頁只顯示 INDEX
   - 系列頁最下方補上「上一個／下一個系列」（SPEC §4.3 原本就要求但一直沒做）——`src/lib/collections/get-adjacent-collections.ts` 的 `getAdjacentCollections()`，只依 `visibility === 'public'` 的順序算，只選需要的三個欄位（延續 SEO 批次「不要 select 整列」的原則）
   - 這批也在 `SiteNav` 補了跟語言切換鈕同樣的觸控範圍教訓（原本每個連結只有 15px 高，加 `py-2.5` 撐到 35px）

4. **首頁/關於頁新增淺色/深色切換**（`ThemeSwitchButton`，跟語言切換鈕疊成同一叢右上角按鈕）——**這是使用者偏好，跟系列頁的 `theme`（dark/light/void，設計師依作品內容決定）是兩件獨立的事**，系列頁完全不受影響。實作：`globals.css` 新增 `--ui-bg`/`--ui-fg`/`--ui-muted` 三個 CSS 變數（`[data-ui-theme="light"]` 覆寫），`home-sections.tsx`/`about-sections.tsx`/`site-footer.tsx` 原本寫死的 hex 色碼全部改成 `var(--ui-*)`。Hero 的滿版背景照片刻意不跟著切換（文字疊在照片上需要固定的深色遮罩維持可讀性，跟系統偏好無關）。

5. **系列頁新增統計數字區塊**（`CollectionStats`，業主指定參考 aoiofficial.com 商品頁的「大數字+小標籤」呈現）——顯示 `year`/`pieceCount`/`category`（`collections` 表既有欄位，不是新資料模型），固定版位在標題之後、第一個設計區塊之前，不是 Block Editor 第 13 種可拖曳區塊。三個欄位任何一個有值才顯示對應項目，全部沒有就整段不渲染。**目前三個系列這三個欄位都還是 `null`（SPEC §10.3 待業主提供），這個區塊現在不會顯示任何東西**——用臨時測試值驗證過正確運作（`2026`/`Year 年份`、`8`/`Pieces 件數`、`Womenswear`/`Category 類型`），測完已清空。只接公開前台，admin 預覽 iframe 目前沒有查這三個欄位。

6. **系列頁新增「捲動釘住標題」**（`PinnedTitle`，業主指定參考 aoiofficial.com Salon 頁面手法）——系列標題超大字級、8% 透明度 `position: fixed` 固定在畫面正中央，`z-index: -1` 讓一般文件流的區塊圖片自然疊在上面遮住，只有留白處才透出文字，不需要每個區塊自己處理遮擋，也不需要 JS scroll listener。

7. **首頁 Hero 大改版**（`src/app/hero.tsx`，業主指定參考 aoiofficial.com 首頁）——這是這批影響最大的改動，經過兩輪迭代：
   - **第一輪**：從「文字疊在滿版背景輪播上」改成左右兩欄，左欄純文字面板（純色背景）、右欄輪播
   - **第二輪（業主看過第一輪後要求）**：改成**左右兩欄同時輪播**，且**業主明確要求「左右的照片要是同系列的」**——兩欄由同一個 `index`/`prevIndex` 狀態驅動，各自顯示同一個 `HeroPair` 的 `left`/`right`，保證任何時刻兩欄都屬於同一個系列。文字疊層改成蓋在左欄圖片上（不再是獨立純色面板），**靠左對齊**（手機/桌機都靠左，不是只有桌機），用 `mix-blend-mode: overlay` 做「文字跟著背景照片明暗變化」的半透明效果（業主提供參考截圖是這種效果，不是單純調低 opacity）
   - 轉場效果：「模糊快閃」（`hero-flicker-enter`/`hero-flicker-exit` keyframes，`globals.css`）——換圖瞬間新圖從模糊+放大淡入、舊圖同時模糊+縮小淡出，兩者時間軸重疊，比單純 crossfade 更有動態感。沒有引入 framer-motion（專案目前其實沒裝這個套件，儘管 SPEC 技術棧欄位有列），沿用純 CSS `@keyframes` 手法
   - **後端配對邏輯**（`src/lib/media/featured.ts`）：`getHomeCarouselPairs()` 取代原本攤平單一圖片池的 `getHomeCarouselImages()`。**業主追問「精選照選多張才要真的有用」**（原本邏輯只吃精選清單第 1、2 張，選再多也沒用）——改成**依序兩兩一組湊出多對**（第 1、2 張第一對，第 3、4 張第二對……），選得越多對，該系列在輪播裡出現的組合越豐富；奇數張時最後一張落單直接丟棄，不會混到下一個系列。Fallback 數量從 3 調成 4（湊對用，3 張永遠浪費最後一張）。用真實資料庫驗證過：三個系列目前分別湊出 6/12/9 對（共 27 對），且逐一確認每對的 `left`/`right` 都屬於同一個系列（z-index 檢查法：抓 DOM 裡 z-index=2 的「目前顯示」圖片，確認兩張都是同一個 `r2Key` 前綴）
   - **後台編輯器同步更新**：業主指出「選了多張看不出哪張是左哪張是右」——`FeaturedPhotosForm` 新增 `PairPreview`，把已選照片依序兩兩分組顯示，明確標「第 N 對」＋「左 Left / 右 Right」，落單的最後一張灰階標示「不會使用」。實測用 pure-land 系列（13 張精選照）確認正確分組成 6 對 + 1 落單。

8. **ASCII 美學效果——做了又整個撤掉**：業主一度要求加入 ASCII 藝術風格（照片即時轉字元畫），技術上做出來了（`/api/ascii-source` 同源代理繞過 R2 bucket 沒有 CORS header 的限制、canvas 讀像素轉字元、疊在首頁系列列表 hover 效果），業主看過後決定取消，**已完整移除**（`src/app/api/ascii-source/`、`src/components/ascii-image.tsx`、`src/app/series-card.tsx` 三個檔案都刪除，`home-sections.tsx` 還原成原本的內聯寫法）。記錄這件事是避免以後有人以為這個功能還在或漏刪。

9. **參考網站設計分析**——業主先後給了兩個參考站要求逆向分析設計手法：Wix marketplace 範本 "Bernard"（攝影師作品集）跟 aoiofficial.com（精品時尚電商）。分析內容（字體/排版/圖形/動畫/互動）都只在對話中討論，沒有寫進任何文件——**明確排除複製版權內容**：不採用對方的具體文案、品牌名稱、示範照片，只借用版面手法/互動模式（這些不受著作權保護），套用到業主自己的內容上。這兩次分析促成了上面第 3/4/5/6/7 項的大部分靈感來源。

10. **後台新增本機測試登入捷徑**（`src/app/admin/login/dev-login-action.ts`）——業主反應真實 Magic Link 流程（等信、點連結）拖慢自己測試的速度，要求先簡化、上線前再加回安全強度。**這支刻意設計成不需要記得之後拿掉**：`devLogin()` 第一行就擋 `process.env.NODE_ENV === "production"`，Vercel production 部署這個值一定是 `"production"`（Next.js 內建行為，不是本專案自訂環境變數，不會因為業主忘記關閉設定而變成正式站後門）。效果等同 HANDOFF 過去記錄的手動測試方式（直接插入 session 列 + 設 cookie），差別是自動化成登入頁一顆按鈕（只在非 production 顯示）。實測：點擊後直接建立 session、導向 `/admin/collections`，跟正常 Magic Link 登入產生的 session 完全相容。

11. **首頁下半部改版（2026-09-20，業主指定參考 aoiofficial.com「往下滑的區域」，本機驗證後已 push）**——只借用版面手法，沒有用對方的文案與圖片：
   - **系列區塊**（`src/app/home-sections.tsx` 的 `SeriesSections`，取代原本的 `SeriesList`）：每個系列一整段，底色用該系列自己的 `theme`（SPEC §4.3；現在依 sortOrder 是淨土 light → Cumedy dark → X-venom void，天然有黑白交替的節奏）。桌機 12 欄格線，文字欄（序號、標題、年份—類型、「查看系列」連結）`sticky` 釘住、右邊拼貼往上捲過，奇偶段左右交替（DOM 順序永遠文字在前，只用 CSS 格線位置換邊）；拼貼是一張高圖（系列封面 `coverImageId`，沒設就用精選池第一張）＋兩張小圖錯位（`getSeriesShowcase()`，`src/lib/media/featured.ts`，沿用精選/fallback 池、只選需要的欄位、只查 public 系列）。拼貼整塊是連到系列頁的連結但 `aria-hidden` + `tabIndex=-1`（同目的地已有「查看系列」連結）。系列區塊底色是「作品的一部分」，**不受**右上角淺色/深色切換影響（切換只影響 Hero、簡介、頁尾）。仍然只有 SPEC §4.2 規定的資訊，不帶 statement 摘要。
   - **簡介區塊**（`BioSection`）：有圖時做成「捲動釘住的宣言區」——外層 200vh、裡面 `sticky` 滿版容器（圖＋45% 黑遮罩＋置中白字），純 CSS、沒有 scroll 監聽；圖用 `aboutImageId`，沒有就退回 `heroImageId`，都沒有就退回單純置中文字。**bio 目前仍是空的（待業主提供），所以這整段現在不會顯示，沒有肉眼驗證過視覺效果**。
   - **頁尾**（`src/components/site-footer.tsx`，首頁與關於頁共用）：兩組極小、字距拉開的連結（Work／About、信箱／Instagram）＋最底下滿寬姓名字樣（`NAME_LOGOTYPE.en`，用 CSS mask、顏色取 `--ui-fg`，所以淺色/深色切換時跟著變色）；字樣沒設時退回同尺度的文字。
   - **重構**：姓名字樣設定檔從 `src/app/hero-logotype.ts` 搬到 `src/lib/brand/name-logotype.ts`（`NAME_LOGOTYPE`，Hero 與頁尾共用）；三種系列主題色抽到 `src/lib/collections/theme-colors.ts`（`block-render.tsx` 是 `"use client"`，server component 不能從它 import 常數），`block-render.tsx` 改從那裡取。
   - **驗證**：桌機 1440／手機 390 用 DOM 量過——三段主題色（light/dark/void）、文字欄 `position: sticky`、偶數段左右換邊、拼貼寬度、無橫向捲動、頁尾字樣滿寬且切主題時變色；9 張拼貼圖的 R2 網址全部 curl 回 200 `image/webp`；`tsc`、`eslint src` 通過。**⚠️ 沒有肉眼看過實際畫面**（瀏覽器面板是隱藏狀態，截圖是空白的，懶載入圖片也不會觸發），拼貼的錯位比例、間距、字級都是憑參考站的量測值＋判斷，需要業主實際看過調整。Cumedy Night（含裸露內容、`requiresConsent`）的圖現在也出現在首頁拼貼，跟 Hero 輪播用同一個精選池，首頁原本就有它的封面圖，不是這批新增的曝光，但如果業主想避開，需要另外決定。

12. **系列內頁改版：左欄固定敘述、右欄捲動系列全部作品（2026-09-21，業主指出「圖片不齊全、文字佔太大版面」，本機驗證後已 push）**——
   - **⚠️ 最大的決策：公開的 `/work/[slug]` 不再用區塊編輯器（Block Editor）的排版，改成直接讀 `media` 表裡屬於該系列的全部圖**（`src/lib/collections/get-series-gallery.ts`）。visibility／已發布判斷（`getPublishedCollection`）完全沒動——草稿與從沒發布過的系列一樣 404，「發布」現在的作用是「系列上線的開關」，區塊編輯器的排版**不再影響公開頁面**（admin 即時預覽 iframe 仍用 `CollectionBlocksRender`，沒動）。要退回原本行為，只需把 `page.tsx`／`work-page-client.tsx` 改回 `CollectionBlocksRender`。**副作用：Cumedy Night 原本業主要自己在區塊編輯器從 33 張成品照精選 8–12 張，現在全部 48 件（33 成品＋4 海報＋11 手繪）都會上架**；內容提示層（`requiresConsent`）仍然有效。如果業主想保留精選權，需要新增「這張圖要不要在長廊顯示」之類的欄位（例如 `media.galleryHidden`）——還沒做。
   - **版面**（`src/app/work/[slug]/series-gallery.tsx`）：桌機左欄 36% `sticky` 釘住（標題、年份—類型—件數［目前三欄都是 null 所以不顯示］、完整雙語敘述、目前第幾件的計數＋進度線）、右欄 64% 捲動全部作品；手機上下堆疊，敘述預設收合成約 6 行、有「閱讀概念」展開鈕。同意提示層、左上導航、EN/ZH 切換、上一個/下一個系列都保留。舊的 `PinnedTitle`／`CollectionStats` 不再用在公開頁（只剩 admin 預覽在用）。
   - **三種展示風格**（`src/lib/collections/gallery-style.ts`，**風格直接由系列 `theme` 決定**：dark→flash、light→still、void→venom，不加資料庫欄位——三個系列的體感跟主題本來就一對一；新系列會依主題自動得到風格，體感不一致時再改成欄位）：
     - **flash／Cumedy Night**：兩欄緊貼拼貼（依「哪欄較矮放哪欄」分配）、圖片微傾斜（±1.3°，手繪稿 ±3.2°縮成 72% 寬）、互相壓住；進場像閃燈（亮度瞬間爆高再 `steps` 硬切）；滑鼠懸停該張跳到最前、其餘變暗；順序成品→海報→手繪稿。
     - **still／淨土**：每件獨佔 `100svh`，圖不裁切（框比例＝圖比例，高度上限 76vh），1.6 秒慢慢浮現；左欄敘述隨捲動一行一行亮起（目前那行 1、已讀 0.55、未讀 0.22，中英同步）。
     - **venom／X-venom「感染擴散」**（業主看過原本的游標透鏡〔模糊＋壓暗＋游標挖洞〕後決定取消，已完整移除）：作品全程清楚可見，靠敘述裡的「病徵」逐步出現——**尖刺**（越往後每張圖邊緣被 `clip-path` 咬出越深的鋸齒，0.6%→5.5%，從第一張非海報開始長；海報是設計師自己的作品，永遠完整）、**斑點**（鏽紅／軍綠噴漆斑點，後層 70 個在圖後面、前層 26 個小斑點落在圖上，密度隨頁面往下遞增，位置確定性生成）、**神經失控**（`--v` 由捲動速度決定，捲得越快圖越抖越歪〔`translateX` 3~7px、`skewX` 0.8~2.2°〕，停下來 90ms 後歸零、0.4s 平順恢復；慢慢捲不受影響）；順序海報→成品→細節；作品間距 20vh→1vh、寬度 56%→94% 逐件縮小放大；進場是「神經接觸不良」式的亮暗閃兩下（只動 opacity，不跟抖動的 transform 衝突）；左欄敘述行距逐句 1.95→1.05、鏽紅重影 0→2px。
   - **資料細節**：`media.width/height` 存的**已經是旋轉後（轉正後）**的尺寸（`generateAndUploadVariants` 回傳的就是轉正後寬高，後台 `rotateMedia` 也寫回這組值；淨土手繪稿存 2482×3510、`rotation: 90`，實際變體檔 800×1131 直式），算顯示比例時**不能**再依 `rotation` 對調——2026-09-21 修掉的 bug：原本多對調一次，手繪稿被放進橫式的框再被 `cover` 裁掉，用真實變體檔量到才發現（之前只驗證了版面數字，沒拿真實圖檔比對比例）。圖庫所有 alt 文字目前都是空的，退回「系列名 — 類型 序號」。`PublishedCollectionRow` 新增 `id`、`statementZh`（仍然只選需要的欄位）。
   - **驗證**（桌機 1440、手機 390，用 DOM 量）：三個系列各自的結構、左欄 `sticky`、進度 `--p` 與計數（06/19→12/19→18/19、23/48、18/18）隨捲動正確更新；淨土敘述亮起行依進度前進；venom（透鏡版）的模糊/亮度/遮罩洞座標/間距/寬度/行距/重影都量過，之後換成感染擴散版，另外量過：海報 6 張無切邊、非海報尖刺深度遞增、斑點密度隨頁面往下遞增、連續快速捲動 `--v`=1.00 且停止後歸零、手機版無橫向捲動；手機收合/展開；同意提示層仍擋 Cumedy；`tsc`、`eslint src` 通過、console 無錯誤。**抓到並修掉一個 bug**：Cumedy 圖片傾斜＋位移造成右邊超出視窗約 9px、出現橫向捲動，改用 `overflow-x: clip`（不會建立捲動容器，不影響 sticky）。
   - **⚠️ 沒有肉眼看過任何畫面**（瀏覽器面板是隱藏狀態，截圖空白、`requestAnimationFrame`/CSS 轉場/懶載入圖片/`IntersectionObserver` 都不會跑）：閃燈動畫的手感、淨土的節奏、透鏡的視覺效果、間距與傾斜角度都只是依數值判斷；`prefers-reduced-motion` 只寫了 CSS（一律直接顯示、隱藏透鏡）沒有實測；（原本的透鏡在 Safari 的相容性疑慮隨著取消透鏡已不存在；`clip-path` 多邊形各瀏覽器支援良好。）另外抓到並修掉一個 hydration 警告：斑點的行內樣式用未取整的長小數，瀏覽器解析 style 屬性時會四捨五入、React 誤判成 mismatch，改成固定小數位＋用 `backgroundImage` 而非 `background` 簡寫。

13. **後台旋轉：預覽即時反映＋網址跟著內容變（2026-09-21，業主要求「後端旋轉後預覽要即時顯示前端最後的樣子」，本機驗證後已 push）**——
   - **根本問題**：`rotateMedia` 原本把新變體覆蓋在**同一個 R2 網址**上，而變體是 `Cache-Control: immutable, max-age=1 年`——縮圖網址旋轉前後完全一樣，瀏覽器/CDN 不會重抓，所以旋轉後只有「旋轉 90°」文字會變、縮圖不動（重新整理也可能還是舊圖），**前台也一樣**（已看過舊圖的訪客一年內都是舊方向）。
   - **做法**（`src/lib/media/keys.ts`）：旋轉後變體放到**新的網址前綴** `${base}~${rotation}`，資料庫 `media.r2Key` 改指向它；因為前台/後台 21 個檔案都是讀資料庫的 `r2Key` 組網址，一改就全部同步，不用一個個加版本參數。網址與內容一對一（同一前綴永遠是同一個角度），所以永久快取安全；`~0` 和沒有後綴的舊網址不同，避免撞到過期快取。**原檔（私有 bucket）永遠留在基底前綴** `${base}/original.*`（`generateAndUploadVariants` 新增 `uploadOriginal` 參數，旋轉時傳 false）。從沒旋轉過的圖（含匯入時就帶 rotation 的淨土手繪稿）`r2Key` 就是基底本身，不受影響。
   - **順序與安全性**：先上傳新變體、再改資料庫（中途失敗時資料庫仍指向完好的舊前綴）；成功後 `revalidatePath` 首頁、關於頁（靜態產生，HTML 裡是舊網址）、`/work/[slug]`。**舊前綴的變體旋轉當下刻意不刪**（靜態頁重新驗證前 HTML 還是舊網址，刪了會破圖），殘留物件在刪除該張圖時由 `batchDeleteMedia` 一次清掉（基底＋四個角度的前綴各清一遍；原檔在基底前綴）。副作用：每旋轉一次會在 R2 多留約 4 個小檔（可接受，不主動清理）。
   - **後台卡片**（`src/app/admin/media/media-card.tsx`）：按下去縮圖**立刻**用 CSS 轉 90°（不等伺服器，重新生成四個尺寸要幾秒），按鈕顯示「旋轉中…」；伺服器完成後先把新網址的 400/800 變體預載進快取，再一次換上新圖並拿掉暫時的 CSS 旋轉（不會閃舊圖或空白）；失敗會復原並跳提示。
   - **驗證（真實 Turso + R2，用臨時上傳的測試圖，測完已從後台刪除、圖庫回到 86 筆）**：點下去 60ms 後 `transform: rotate(90deg)`＋按鈕「旋轉中…」；約 2.8 秒後網址換成 `…~90`、CSS 旋轉移除；新前綴 400/800 回 200 且方向正確（舊前綴直式 400×600 → 新前綴橫式 400×267），舊前綴仍在；資料庫 `r2Key`＝`~90`、`rotation`＝90、寬高＝轉正後 900×600；連續旋轉網址鏈 `~90→~180→~270→~0`；刪除後五個前綴的變體全部 404、私有 bucket 原檔 404、資料庫列消失。**⚠️ 教訓**：找測試圖時一度想拿「未指派系列」的那張來測，其實它是關於頁正在公開展示的金點新秀證書——「沒有 collectionId」不代表沒在使用，改成臨時上傳測試圖。
   - **限制**：卡片縮圖用 `cover` 裁成正方形，CSS 暫時旋轉在焦點不在正中央時與真正旋轉後的裁切略有差異（只在轉場那 2～3 秒）；只有後台圖庫卡片有「立即轉」的動畫，其他後台頁面（區塊編輯器選圖、精選照表單）是讀取當下的資料庫值，重新整理後就是新網址。**沒有肉眼看過實際畫面**（同樣受限於隱藏面板），動畫用行內樣式與時間軸數值驗證。

14. **Cumedy 手繪稿破圖（2026-09-21，業主回報 `/work/cumedy-night` 的 Sketch 40/41/42 讀取失敗）——已修，資料已補**：
   - **根因**：匯入/上傳時「原圖比目標尺寸小就不放大、**跳過該變體**」（SPEC §1.3 原文），所以約 1000～1500px 寬的小原檔（設計牆照片、手繪稿）只有 400/800 兩檔，**沒有 1600/2400**；但 `image-loader.ts` 只會挑「大於等於需求寬度的下一檔」，大螢幕/高解析度（業主的瀏覽器）要求的寬度超過 800 時就去要不存在的 1600 → 404，畫面上只剩我補的 alt 文字「Cumedy Night — Sketch 40」。**跟旋轉無關**（一開始懷疑是旋轉造成，實際資料一查，缺檔的 rotation 都是 0）。我自己的測試沒抓到，因為視窗小、解析度低，要求的寬度剛好落在 800 以內。
   - **修法**：`generateAndUploadVariants`（`src/lib/media/generate-variants.ts`）不再跳過，四個尺寸一律生成，`withoutEnlargement` 保證不放大畫素（大尺寸檔就是原始尺寸那份）；新增 `onlyWidths` 選項（只補指定寬度）。SPEC §1.3 那條規則同步改掉。
   - **補檔（真實 R2）**：全站 86 筆 media 檢查 344 個變體網址，缺檔 11 筆（Cumedy 手繪稿 9＋海報 1〔只缺 2400〕＋未指派系列 1〔關於頁的證書，只用小尺寸所以沒破圖〕）；用臨時腳本從私有 bucket 的原檔重新生成**只缺的那幾個尺寸**（已存在的檔案沒動），11 筆全成功；補完再查 **344/344 全部 200**，補上的檔案是原始尺寸（988×1656）沒放大。臨時腳本已刪。
   - **教訓**：載入器與「變體是否存在」是隱含耦合——任何生成變體的路徑（上傳、旋轉、匯入腳本）都必須保證四個尺寸齊全；驗證圖片時要拿高解析度（DPR 2）、大視窗的情境，不能只用小視窗量版面。

15. **手機版 UI/UX 優化（2026-09-21，業主要求，本機驗證後已 push）**——**第一次真的看到手機畫面**：之前瀏覽器面板是隱藏的、截圖空白，只能量數字；這次改用 `puppeteer-core`（裝在對話暫存目錄，不進專案）＋本機 Chrome 做**真正的裝置模擬**（390×844、DPR 2、觸控、iPhone UA），可以截圖、真的捲動、量計算後樣式。⚠️ 教訓：純 `chrome --headless --window-size=390` 不準——無頭 Chrome 視窗最小寬約 500px，畫面是被裁成 390 的，右上角固定按鈕會消失、版面也不是真的 390 寬。
   - **看到的問題與修法**：
     1. **固定在畫面上的導航與右上兩顆 44px 切換鈕一直蓋住內容**（標題被 DARK 按鈕蓋掉一個字、導航壓在圖上）→ 手機（<1024px）往下捲就收起（`opacity 0` + 位移）、往上捲或回到頂端（<80px）再出現、鍵盤 Tab 進去會立刻顯示；`SiteNav` 改成 client 元件、用 `<html data-chrome-hidden>` 旗標＋`[data-chrome]` CSS（`globals.css`）；桌機不受影響（CSS 只在 max-width:1023px）；尊重 `prefers-reduced-motion`。
     2. **點擊範圍太小**（「查看系列」與頁尾連結約 14px 高、導航連結 35px、同意提示按鈕 36px）→ 全部提到 ≥44px（導航連結、「查看系列」、頁尾連結、同意/返回按鈕；頁尾連結桌機維持原本緊湊）。
     3. **淨土敘述在手機上幾乎是灰的**（「隨捲動逐行亮起」只在桌機左欄釘住時看得到，手機文字捲走後調暗只會難讀）→ 只有 lg 以上才套用調暗（`lg:opacity-[var(--lo)]`）。
     4. **淨土每件作品之間空一大片**（強制 `100svh`，手機圖只有約 470px 高，前後各空 450px）→ 手機不強制滿屏、間距縮小（`py-[9svh]`）、圖寬 88%；作品間距 450px→180px、整頁高度 16663px→11662px（約少 30%）；桌機維持一屏一件。
     5. **手機沒有左欄，捲動時看不到目前第幾件** → 系列頁補一個固定在右下角的小計數＋進度線（一開始透明、捲進作品區才淡入；`lg:hidden`）。
     6. **關於頁證書被裁切**（直式證書被放進 4:3 框 + `cover`，上方標題與下方印章被截掉，**所有裝置都有**）→ 用證書真實比例（從 `media.width/height` 算）＋`contain`，完整顯示。
   - **驗證**（真實裝置模擬）：控制列 top→往下捲 900px→往上捲 200px→再往下→Tab 聚焦，狀態依序是 顯示→收起→顯示→收起→顯示；點擊範圍量到導航 44、「查看系列」44、頁尾 44、切換鈕 44、同意按鈕 44；淨土手機敘述透明度全為 1、作品間距 180px、小計數在頂端透明、捲到中段顯示「05 / 19」；證書框 320×448（比例 0.714＝原圖 400×560）；桌機 1440 沒有退化（控制列不收、敘述照常逐行亮起〔0.55,1,0.22…〕、左欄釘住、小計數不出現）；`tsc`、`eslint src` 通過。
   - **沒改但看過、觀感 OK**：首頁 Hero（兩張圖上下堆疊，姓名字樣沒超出）、Cumedy 兩欄緊貼拼貼、X-venom 鋸齒邊與鏽紅斑點。**可以再考慮**（沒做）：首頁 Hero 手機只顯示一欄、X-venom 手機的作品間距（20vh 起）偏長、鏽紅斑點看起來像失焦光暈。

16. **標題斷行、「View series」按鈕、敘述可讀性（2026-09-21，業主看正式站截圖後回報，本機驗證後已 push）**——
   - **標題**（首頁系列區塊、系列頁左欄）：原本中文緊貼在英文後面，標題一長就在兩種語言之間任意斷行（「在最後的淨土 / 上孤獨」、「X- / venom」）。改成**英文、中文各佔一行**（`.series-title-lang` 改 flex column；`data-lang="zh"` 時中文在上）；中文是次要語言時（0.55em）`white-space: nowrap`，是主要語言時允許換行並 `text-wrap: balance`。**中文標題與英文一樣時不再顯示第二次**（X-venom 的 `titleZh` 也是 "X-venom"，`src/lib/collections/display-title.ts` 的 `zhTitleForDisplay`）。
   - **「View series」**：從 0.7rem 的底線文字連結改成有外框的真按鈕（228×58、字級 14.4px、hover 反白）。hover 反白用區塊自己的 `--sec-bg`/`--sec-fg`——⚠️ 不能用 `bg-current`，文字色會跟底色一樣而消失。
   - **敘述可讀性**：SPEC §6.1 的次要語言 0.55em 對標題/短標籤合理，對整段敘述太小（中文約 8px）。新增 `.lang-readable`（`globals.css`）：範圍內次要語言改成 0.85em、透明度 0.75、中文行距 1.95；桌機敘述字級 1.05rem（超過 500 字的長敘述 0.95rem）、行距 1.85；淨土逐行亮起的未讀/已讀透明度 0.22/0.55 → 0.6/0.75（原本未讀句子幾乎看不到）；X-venom 行距逐句縮小的下限 1.05 → 1.45（原本後面幾句擠到讀不了）。**偏離 SPEC §6.1 的 0.55em，僅限敘述與按鈕。**
   - **長敘述放不下的問題**（淨土：英文 8 行＋中文 7 行，900px 高的螢幕放不下，中文被擠到底被截掉）：標題與資訊固定在左欄上方，只有敘述那一塊內部捲動（底部淡出＋細捲軸）；淨土的敘述會**自動捲到目前亮起的那一行**（像提詞機，用座標差只捲左欄容器、不用 `scrollIntoView` 以免把整頁捲走；尊重 `prefers-reduced-motion`），所以看到的作品跟正在讀的句子永遠對得上。X-venom、Cumedy 的敘述放得下、不需要捲動。
   - **驗證**（真實 Chrome，1440×900 與 390×844）：首頁標題各佔一行、中文單行、按鈕 228×58；敘述英文 16.8px／中文 14.3px（原本約 8.4px）；淨土捲動 0/50/100% 時亮起的行都在可見範圍內、標題永遠可見（`h1Top` 固定 96）；手機收合 168px／展開 718px、中文 12.9px、無橫向捲動；`tsc`、`eslint src` 通過。過程中開發伺服器一度卡住（60 秒無回應，CPU 幾乎為零，跑了一連串 puppeteer 之後），重啟即恢復。

17. **第一次來的訪客引導（2026-09-22，測試者回報「目前不直覺」，本機驗證後已 push）**——以「完全不了解這個網站設計走向的人」的視角走一遍首屏→系列頁，用真實 Chrome 審計後找到的問題：
   - **審計結果**：導覽「Bio」是**死連結**（指向 `#bio`，bio 還沒填所以沒有這個區塊，點了沒反應）；首屏 **0 個連結**（照片點不動、沒有任何下一步）；**完全沒有往下捲的提示**；切換鈕只顯示目前狀態（「EN」「DARK」），陌生人不知道按了會變什麼、甚至不知道有中文；首屏只有姓名與一行很淡的職稱。
   - **首屏**（`src/app/hero.tsx`）：照片整欄可點、進到該系列（`SeriesClickLayer`，蓋在輪播上，`aria-hidden`＋`tabIndex=-1` 因為底部有可聚焦的同目的地連結；文字疊層是 `pointer-events-none`，點擊會穿透）；底部新增引導列——左邊卡片「Now showing 目前展示 → 系列名稱（中英各一行）→ View series 查看系列」（跟著輪播換系列、淡入），右邊「Scroll to explore 往下瀏覽作品」＋一條會動的細線（往下捲 >40px 淡出；手機只留動畫線條）。⚠️ **引導列一開始用了跟姓名一樣的 difference 混合，實測在淺色照片上小字變成低對比灰褐色幾乎讀不出來**，改成跟導覽列同風格的半透明黑底小卡片（`bg-black/55` + `backdrop-blur`）；引導元素的重點是被看見。`getHomeCarouselPairs()` 每一對現在帶 `series`（slug/標題）；退回的單張靜態圖 `series: null`（不顯示卡片、照片不可點）。職稱那行（「這個人做什麼的」）放大加粗（英文 20px、中文 17px，原本約 14px/8px）。
   - **導覽與切換鈕**：`SiteNav` 標籤跟著語言（Work/作品、Bio/簡介、About/關於、Home/首頁）；「INDEX」（設計圈行話）改成「Home」；系列頁與關於頁新增「Work」（→ `/#series`，看完一個系列想看別的不必回首頁再往下找）；**簡介沒填時不顯示「Bio」**（`LangPageWrapper` 新增 `hasBio` 屬性，首頁傳入）。語言鈕同時顯示「EN / 中」、目前的粗體（SPEC §6.3 原本就是這樣）；主題鈕改成太陽/月亮圖示（顯示「按下去會變成的樣子」，深色模式顯示太陽）＋`title` 提示。
   - **首頁區塊說明**（`home-sections.tsx`）：系列列表前加標題「Selected work 作品」＋一句「N collections. Choose one to browse every piece. / N 個系列，點進去瀏覽每一件作品。」（原本首屏之後直接是第一個系列，沒有說明這裡是可以點進去的作品列表）；用介面色，跟著淺色/深色切換。
   - **系列頁**：左欄新增提示「Scroll to browse all N works 向下捲動，瀏覽全部 N 件作品」＋動畫細線，捲進作品區就淡出（`ScrollHint`，`--p`）。
   - **驗證**（真實 Chrome）：導覽死連結 0 個；ZH 模式導覽「作品 / 關於」；系列頁導覽 Home→/、Work→/#series、About→/about；首屏 3 個照片連結＋底部卡片；往下捲後提示透明度 1→0（首屏與系列頁都是）；**實際點首屏照片會進到 `/work/pure-land`**（一開始我量得太早以為沒作用，開發模式第一次進頁面要編譯幾秒；`elementFromPoint` 在整個首屏都命中照片連結）；桌機 1440／手機 390 兩張卡片不重疊、無橫向捲動；`tsc`、`eslint src` 通過。
   - **沒做／該考慮**：**還沒有真人測試驗證這些引導是否真的解決「不直覺」**——這是憑審計與慣例判斷；首屏輪播會自動換圖，卡片跟著淡入換系列，可能需要看實際感受；Cumedy 的同意提示層之前沒有任何說明就是一片黑，沒動；首屏姓名字樣本身沒有說明性文字（只有姓名＋職稱）。

**測試方法**：每一項都在本機 `pnpm dev` 截圖/DOM 檢查驗證過（部分項目用臨時腳本寫入測試資料到真實 Turso 資料庫、驗證後清空，比照這份文件一直以來的慣例）；`tsc --noEmit`、`eslint src` 全專案在每一項改動後都跑過確認通過。（這一批後來已全部 commit 並 push，見 git 歷史。）


18. **關於頁改版＋獲獎跑馬燈搬到首頁（2026-09-24～28，業主多輪回饋，commit `beca9dd` 已 push）**——
   - **首頁**：獲獎跑馬燈（`src/components/awards-marquee.tsx`）放在 Hero 之後、「Selected work／作品」區塊**上面**（業主指定；中間一度放在頁尾前）。反相色帶、巨大字級；基礎速度 92 px/s（業主要求調快，原 56）；往下捲加速、往上捲只會減速到接近停止、**不會反向**（第一版會倒著跑，像壞掉）；滑鼠移上去暫停並淡化其他項；**有顯式暫停/播放鈕**（觸控沒有 hover，原本手機無法暫停，也不符合 WCAG 2.2.2）；畫面外不跑；`prefers-reduced-motion` 時改成靜態清單、按鈕不顯示（已實測）。
   - **關於頁**：業主要「一目瞭然」「不用先秀名字，直接展示 awards」——拿掉全螢幕姓名開場（`AboutIntro`），頁面第一節就是靜態獲獎清單（`AwardsList`，`about-sections.tsx`），之後是證書、簡介、聯絡（簡介/聯絡沒資料不渲染）。保留一個 `sr-only` 的 `<h1>`（SEO／螢幕閱讀器）。
     - **名次「跳色」**：成績標籤用金色 `--award-accent`（深色主題 `#FFC53D`、淺色 `#6B4E00`，對背景對比 12.5:1／7.0:1）——**刻意偏離 SPEC §5.1 介面三色**，業主本人要求，範圍只限這個徽章。
     - **標題一行看完**：用 CSS Container Query 依字數自動縮放（`.award-list` 是 container；每個標題帶 `--en-chars`／`--zh-chars`；公式「欄寬 ÷ 字數 ÷ 字寬比例」，中文比例 1.2、英文 0.65，已含 0.06em／0.01em 字距）。有英文譯名的獎項用 `min()` 同時檢查主/次語言兩行，不破壞 SPEC §6.1 的 0.55 主從比例。實測 360–1920px、EN/中、深/淺，四筆標題全部單行（用 `Range.getClientRects()` 量文字節點本身，第一版比例 1.05 漏算字距、在 855px 欄寬下仍會換行，這樣才抓到）。
   - 新增通用 `.lang-pair`（英中同一行、留間距，修「Fashion Designer服裝設計師」黏在一起）。⚠️ `src/components/scroll-cue.tsx` 是當時給關於頁開場用的，開場拿掉後**目前沒有任何地方使用**（可刪，沒刪）。
   - **沒驗證到**：只看截圖與數值，沒肉眼看過跑馬燈動態手感；Safari／真機沒測。

**Phase 7 — 後台全面改版（2026-10-22，業主要求「操作順手、介面精美、過場流暢、流程順暢、RWD、及時」；本機驗證完成，2026-10-22 已 commit 並 push）**

業主在開工前決定的三件事（用選項問過）：
1. **區塊編輯器收起來**：系列頁自 9/21 起直接讀圖庫，區塊編輯器的排版不影響前台 → 從導覽移除，程式與網址保留（`/admin/collections/[id]/blocks` 仍可進入，頁面頂端加了「目前不影響前台」的說明）。
2. **手動儲存＋未存提醒**（不是自動存）：整頁一個儲存鈕；有改東西時底部滑出「N 項變更尚未儲存」列（⌘S／Ctrl+S 也能存、可捨棄）；有未存變更時點後台連結會跳確認框、關分頁會跳瀏覽器提醒；改過的欄位標籤旁有小圓點。
3. **作品長廊精選要做**（§6.1 原第 1 項）：可以隱藏個別作品、拖曳自訂順序。

做了什麼：
- **共用元件**（`src/components/admin/ui/`）：按鈕、欄位、開關、分段選擇、卡片、徽章、通知（取代 `alert`）、確認框（取代原生 `confirm`，可以說明刪了會影響什麼）、置中對話框／側邊抽屜（Esc、點背景關閉、焦點鎖定、關閉後焦點回原處、背景不捲動）、未存提醒列、縮圖選圖器（取代所有「檔名下拉選單」，可依系列／類型篩選、搜尋）。`styles.ts` 的 `cn`／`buttonClass` 刻意不放在 `"use client"` 檔案裡——Server Component 不能呼叫 client 模組匯出的一般函式。後台走石墨灰階（Tailwind `stone`）＋ Geist／Noto Sans TC，不受 SPEC §5 前台視覺約束；動畫集中在 `globals.css` 的 `.admin-*`，`prefers-reduced-motion` 時全部縮成瞬間（已實測）。
- **外框**（`src/app/admin/layout.tsx`＋`src/components/admin/shell.tsx`）：桌機左側導覽列、手機頂部列＋左滑抽屜；換頁內容淡入＋`loading.tsx` 骨架；登出鈕；登入頁與預覽 iframe 不套外框。
- **總覽 `/admin`**（SPEC §7.1 原本從未實作，登入後改導到這裡）：統計卡片＋「待補資料」清單（由資料庫即時算：bio、信箱、IG、各系列年份/類型、缺替代文字張數、沒英文名的獎項，每項可直接點過去）＋系列入口。
- **系列編輯器**（`collection-editor.tsx`、`gallery-curator.tsx`）：分段卡片＋黏在頂端的區段導覽（捲動時自動標出目前段落）；公開狀態／主題改成可視化選項卡（主題卡片直接說明對應的長廊節奏）；**作品長廊**縮圖牆可拖曳（滑鼠、手機長按、鍵盤空白鍵＋方向鍵）、眼睛＝前台隱藏、星星＝首頁輪播精選、「改回自動排序」；**首頁精選**條狀清單可拖曳，直接標「第 N 對・左/右」與落單提示。整頁一次存：新 server action `saveCollectionEditor`（libsql batch＝同一筆交易）。舊的 `updateCollection`／`setFeaturedMedia` 已無呼叫端，刪除（少一個可被呼叫的端點）。
- **資料模型**：`media.galleryHidden`（布林，預設 false）、`media.galleryOrder`（整數可空）。排序規則抽成純函式 `src/lib/collections/gallery-order.ts`（前台 `getSeriesGallery` 與後台共用，後台看到的順序就是前台的順序）：系列裡只要有任一張有 `galleryOrder` 就依它排，之後新上傳的排最後；全部 null＝維持原本「依風格類型順序」，沒自訂過的系列外觀完全不變。隱藏的圖不出現在長廊，也不會被首頁拿去當精選／備援圖（`featured.ts` 第二道防線；系列封面是另外明確指定的，不受影響）。
- **圖庫**（`media-library-client.tsx`、`media-detail-sheet.tsx`、`uploader.tsx`）：搜尋＋系列篩選＋類型篩選（含數量）＋「缺替代文字」；縮圖卡片顯示類型、長廊隱藏、首頁精選、缺 alt；勾選（Shift 範圍選取、Esc 取消）後底部浮出批次列（設定類型／指派系列／刪除）。點圖開側邊面板：大圖點一下設裁切焦點＋旁邊即時顯示正方形／3:4 裁切結果、旋轉、類型、系列、中英替代文字、尺寸／檔案大小／上傳日期、**「使用中」清單**（系列封面／分享圖／首頁精選、個人資料的圖、獎項證書——刪除前一定看得到，避免重演差點刪掉證書的事）、← → 切換上下張（方便連續補 alt）。上傳改成 XHR 真進度條、一次最多 3 個、整頁都能拖放，**上傳完直接歸到目前篩選的系列／類型**。新 server action `updateMediaDetails`（一次存類型／系列／alt／焦點）。
- **修掉的既有問題**：(1) 圖庫的類型／alt／系列／焦點／批次／刪除原本只 revalidate `/admin/media`，前台長廊（直接讀 media 表）要等下次自然更新才看得到 → 統一 `revalidateMediaEverywhere()`；(2) 圖片換系列時，舊系列的 `galleryOrder`／`featuredOrder`／隱藏狀態會跟著帶過去（會讓新系列被誤判成「有自訂順序」）→ 換系列時一律重設。
- **個人資料**：分段（姓名職稱／簡介／聯絡／圖片／搜尋與分享），每段說明「會出現在網站哪裡」；IG 貼整段網址或帶 @ 都會整理成帳號；信箱格式即時檢查；Google 搜尋結果即時預覽。
- **比賽經歷**（原本只能改證書圖與是否公開，獎項本身不能增刪改）：每個獎項一張卡片，可新增／修改／刪除（存檔前可捨棄復原）／拖曳或 ↑↓ 排序（順序＝首頁跑馬燈與關於頁順序）、證書縮圖選擇＋公開開關（沒圖時不能開）。新 server action `saveAwards`（batch），revalidate `/about` 與 `/`（首頁跑馬燈）。
- **登入／請查看信箱／登入失敗**三頁重新設計（置中卡片）；登入後導到 `/admin`。

驗證（真實 Chrome 模擬，桌機 1440／手機 390；**正式站與本機共用同一個 Turso，所有寫入測試都先備份→操作→用後台介面還原→逐欄比對**）：
- 系列編輯：隱藏 1 張存檔 → 資料庫 1 筆 hidden、前台 Cumedy 變 47 件且該圖不在 HTML 裡；拖曳換順序存檔 → 前台 RSC 資料裡的 47 件順序與後台完全一致（`618.jpg` 也是封面會先出現在 metadata，比對時排除）；未存時點側欄跳確認框、Esc 取消留在原頁；⌘S 存檔；「改回自動排序＋全部顯示」還原後，48 筆 media 與系列列**逐欄完全相同**（只有 `updated_at` 不同）。
- 圖庫：Cumedy＋手繪稿篩選 11 張（正確）；面板 dirty 提示、未存關閉跳確認、⌘S 存檔、→ 切到下一張；Shift 範圍選取 4 張；替代文字存檔後還原，86 筆 media **逐欄完全相同**。
- 個人資料：填所在地存檔 → 首頁出現；清空還原（空字串存成 null）；信箱格式錯誤會擋；捨棄恢復；資料**完全相同**。（測試腳本一度因 puppeteer 在 macOS 的 ⌘A 無效而把所在地存成「台」，已立刻用後台清空還原；正式站 HTML 確認是 `locationZh: null`，沒有被公開過。）
- 比賽經歷：滑鼠拖曳、↑↓ 移動都正確；武漢長江盃移到第一存檔 → 關於頁與首頁跑馬燈順序都跟著變；新增空白獎項存檔會被擋（需要名稱）；還原後 awards 表**完全相同**。
- 前台五頁、區塊編輯器頁皆無 console 錯誤；所有頁面手機無橫向捲動；`prefers-reduced-motion` 下動畫時間 ≈ 0；`tsc`、`eslint src`、`next build`（17 頁）全部通過。
- **過程中抓到並修掉的 bug**：(1) dnd-kit 的 `aria-describedby` 用全域計數器，伺服器與瀏覽器不同步 → hydration 警告，給每個 `DndContext` 固定 `id`；(2) **換頁淡入動畫用 `animation-fill-mode: both`，結束後 transform 仍「生效中」，Chrome 把 `<main>` 當成 `position: fixed` 的定位基準 → 拖曳永遠判定放回原位、底部儲存列位置也錯**，改成 `backwards`；(3) Shift 範圍選取在 state updater 裡讀 ref 讀到已被覆寫的值；(4) 通知蓋住儲存列的按鈕 → 通知往上留出空間；(5) 圖庫篩選籤在桌機被裁切 → 桌機改換行；(6) 面板大圖下載中是一片灰 → 先鋪快取裡的小圖。

**沒有驗證到的**：只用截圖與數值量測，沒有肉眼操作過拖曳手感與過場節奏；真實 iPhone／Safari 沒測（手機長按拖曳只在 Chrome 觸控模擬下驗證）；上傳流程沒有實際傳檔（不想在正式資料庫留測試圖，程式路徑跟原本一樣只是換成 XHR，若要測請上傳後從面板刪除）；寄信登入沒測（只用本機測試登入）。

### 1.2 進行中／下一步

見本文件第 6 節「下一步具體指令」。

---

## 2. 環境與憑證狀態

### 2.1 `.env.local` 填寫狀態（僅列變數名稱，不含明文值）

| 變數 | 狀態 | 對應服務 |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | **空白** | 網站對外網址，本機開發未設定 |
| `TURSO_DATABASE_URL` | 已填 | Turso 資料庫連線 |
| `TURSO_AUTH_TOKEN` | 已填 | Turso 認證 token |
| `R2_ACCOUNT_ID` | 已填 | Cloudflare R2 帳號 |
| `R2_ACCESS_KEY_ID` | 已填 | R2 S3 相容 API 金鑰 |
| `R2_SECRET_ACCESS_KEY` | 已填 | R2 S3 相容 API 密鑰 |
| `R2_BUCKET_NAME` | 已填 | R2 公開 bucket（`tsengyujui-media`） |
| `R2_ORIGINALS_BUCKET_NAME` | 已填 | R2 私有 bucket（`tsengyujui-originals`） |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | 已填 | 對應公開 bucket 的公開讀取網址 |
| `AUTH_SECRET` | 已填 | Auth.js session 加密金鑰 |
| `AUTH_URL` | 已填 | Auth.js 回呼網址 |
| `EMAIL_SERVER` | **空白** | Nodemailer SMTP 連線字串——本機開發從未真的寄過信，所有登入測試都是直接在資料庫插入 session 列 + 瀏覽器設 cookie 繞過寄信 |
| `EMAIL_FROM` | **空白** | 同上，尚未設定寄件位址 |
| `ALLOWED_LOGIN_EMAILS` | 已填 | 登入白名單（見 §12.2/§12.9） |
| `UPSTASH_REDIS_REST_URL` | 已填 | Upstash Redis REST 連線 |
| `UPSTASH_REDIS_REST_TOKEN` | 已填 | Upstash Redis REST token |

> ⚠️ `EMAIL_SERVER`/`EMAIL_FROM` 空白代表**目前完全沒有測試過真實的 Magic Link 寄信流程**，
> 只測過白名單判斷邏輯本身（`isAllowedEmail()`）與繞過寄信的 session 注入。部署前必須补上
> 真實 SMTP 設定並至少跑過一次真人收信點擊的登入流程。

### 2.2 R2 bucket 現況（2026-09-13 實測數字）

- **`tsengyujui-media`（公開 bucket）**：321 個物件，共 75.9 MB — 只放 400/800/1600/2400px 的 WebP 變體，供前台 `next/image` 讀取
- **`tsengyujui-originals`（私有 bucket）**：85 個物件，共 504.1 MB — 只放每張圖的原始檔（`original.*`），不對外公開讀取

兩個 bucket 是刻意分開的兩個獨立 R2 bucket（見 SPEC.md §12.4 方案 A），不是同一個 bucket 的兩個路徑。

### 2.3 Turso 資料庫

- 資料庫名稱：`tsengyujui-portfolio`
- Group：`tsengyujui`
- Region：`aws-ap-northeast-1`（東京）

### 2.4 Upstash

- 用途：Auth.js 登入端點（`sendVerificationRequest` 前）的速率限制，防止同一使用者/IP 短時間內大量索取 Magic Link（見 SPEC.md §12.3）

### 2.5 本機專用 vs 部署時需重新產生的憑證

- **`AUTH_SECRET`**：Vercel 三環境（Development/Preview/Production）應各自產生獨立的值，不可共用本機的值
- **`AUTH_URL`**：與部署網域綁定，本機是 `http://localhost:3050`，部署後必須換成實際網域
- **`NEXT_PUBLIC_SITE_URL`**：同上，本機空白，部署前必須設定為實際網域（不可加 `NEXT_PUBLIC_` 前綴以外的敏感值，但這個本身就是設計給公開的網址）
- 其餘（Turso、R2、Upstash、`ALLOWED_LOGIN_EMAILS`）可沿用同一組正式環境的憑證，不需要為了本機/正式分開產生，但仍建議依 SPEC.md §1.2 的「Vercel 三環境變數分離設定」個別確認

---

## 3. 資料庫現況（2026-10-22 實測筆數；原 2026-09-13）

| 資料表 | 筆數 |
|---|---|
| `media` | 86（含關於頁證書；2026-10-22 全部 `gallery_hidden=0`、`gallery_order=null`，85 張有指派系列的圖都沒有替代文字） |
| `collections` | 3 |
| `awards` | 4 |
| `blocks` | 25 |
| `profile` | 1 |
| `users` | 1 |
| `sessions` | 27（幾乎都是本機「測試登入」累積的，7 天自動過期；要清可以刪掉已過期的列） |
| `accounts` | 0 |
| `verification_tokens` | 1 |

### 3.1 三個系列的 collection id 與 slug

| slug | collection id | 中文標題 | visibility | publishedAt |
|---|---|---|---|---|
| `pure-land` | `esxi1k69w1tj0hhrutkbcasy` | 在最後的淨土上孤獨 | `public`（2026-09-15 切） | 2026-09-15（第十二批切公開時一併發布現有 10 筆 blocks） |
| `cumedy-night` | `od9x85brwb41br60iatmph26` | 未完待酗 | `public`（2026-09-15 切） | 2026-09-14（第六批草稿/發布機制驗證時發布，內容未變動） |
| `x-venom` | `q98m73u1bk6dque18y4eh30f` | X-venom | `public`（2026-09-15 切） | 2026-09-15（第十二批切公開時一併發布現有 7 筆 blocks） |

（cumedy-night 8 筆 blocks；pure-land 10 筆；x-venom 7 筆，25 筆總數三系列相加正確。`publishedSnapshot`/`publishedAt` 兩欄是 2026-09-14 才新增的，見 §1.1 第六批與 migration `0003_colorful_millenium_guard.sql`。）

### 3.2 已知的 seed 資料狀態（哪些欄位還是 null、待業主提供）

- 三個系列的 `year`、`category`、`pieceCount` 欄位**全部是 `null`**——目前的 seed 完全沒有這三個欄位的資料，待業主提供
- 三個系列的 `ogImageId`、`titleImageId` 也都是 `null`
- 三個系列的 `visibility` **已於 2026-09-15（第十二批）全部切成 `public`**，見 §3.1
- `awards.titleEn` 允許 `null`（migration `0002_youthful_karma.sql` 已放寬），部分獎項的英文標題確實是 `null`，是刻意保留、不是缺漏（見 SPEC.md §10.1 對「金點新秀設計獎」等中文全名的精確度要求，以及「未提供英譯就不要編一個」的原則）
- SPEC.md §10.4 列出的其餘待業主確認事項，見本文件第 5 節

---

## 4. 已修復的重要 bug 清單

1. **EXIF 未清除 + 旋轉尺寸計算錯誤**（`src/lib/media/generate-variants.ts`）
   問題：`.withMetadata({icc:'srgb'})` 會保留全部 EXIF（含 GPS），違反 SPEC §12.4「公開圖片必須移除 EXIF」；另外 `.rotate(deg).metadata()` 讀到的是旋轉**前**的尺寸，導致 90°/270° 旋轉後寬高沒對調。
   修法：改用 `.withIccProfile('srgb')`（不呼叫 `.withMetadata()`/`keepExif`）只留色彩描述檔、去除其餘 EXIF；旋轉 90°/270° 時手動對調寬高，不依賴旋轉後的 `.metadata()`。

2. **R2 兩個 bucket 曾經混用**
   問題：早期實作一度把公開變體與私有原始檔案放進同一個 bucket 的不同路徑。
   修法：改為兩個完全獨立的 bucket（`R2_BUCKET_NAME` 公開 / `R2_ORIGINALS_BUCKET_NAME` 私有），SPEC.md §12.4 方案 A 記錄了決策理由。

3. **系列 slug 驗證死碼**
   問題：Zod schema 裡曾經寫了一段 slug 格式驗證，但因為呼叫順序問題實際上永遠不會被觸發到（死碼），非法 slug 沒被真的擋下來。
   修法：修正驗證呼叫順序，並用真實的非法 slug 輸入實測確認會被擋。

4. **Auth 白名單造成的「可列舉性」漏洞（登入信箱是否在白名單內可被外部探測）**
   問題：原本白名單判斷寫在 `signIn` callback，白名單內/外的信箱登入後會被導向**不同的頁面**（例如一個進 check-email、一個進 error），等於讓任何人都能用「輸入信箱看導向哪裡」來探測誰在白名單內，違反 SPEC §12.2/§12.9「不可列舉」的要求。根因是讀了 `@auth/core` 原始碼才發現：`signIn` 通過後，`sendVerificationRequest` 與 `adapter.createVerificationToken` 是透過 `Promise.all` **平行、互不知情**地執行，只擋其中一個並不會阻止另一個的副作用（例如即使不寄信，token 還是會被建立）。
   修法：`signIn` callback 一律回傳 `true`（不再有分支），白名單判斷改成同時放進 `adapter.createVerificationToken`（非白名單時回傳 `undefined`，不建立 token）與 `sendVerificationRequest`（非白名單時直接 return，不寄信）兩處，確保白名單內外的使用者從 `signIn` 之後的行為與導向**完全一致**，外部無法用導向差異探測白名單成員。

5. **`startTransition` 誤用**（`block-list-client.tsx` 拖曳排序）
   問題：在 `setItems` 的 updater function **裡面**呼叫 `startTransition`，觸發 React（尤其 Strict Mode 下 updater 可能被重複呼叫）的 `"Cannot call startTransition while rendering"` 錯誤——這是實測跑出來的錯誤，不是理論推測。
   修法：把 `setItems(next)` 和 `startTransition(...)` 拆成兩個平行陳述式，不要巢狀。

6. **新增區塊後畫面顯示舊資料**
   問題：`createBlock` 的預設 config 是 server 端算出來的，前端新增後如果只更新本地 state 會顯示不準確的假資料。
   修法：新增後呼叫 `router.refresh()` 重新拿 Server Component 資料，並用 `useEffect(() => setItems(initialBlocks), [initialBlocks])` 把新的 props 同步回本地 state。

---

## 5. 待業主確認清單（原複製自 SPEC.md §10.4；2026-09-15 第十二批已收斂大部分項目，狀態見下）

- [ ] **Cumedy 拼字** — 確認保留原拼字（規格書已按保留處理，尚未有業主明確覆核，但不影響任何工作，維持現狀）
- [ ] **色彩策略** — 介面黑灰白、作品區跟隨作品（偏離原始「全站黑灰白」需求）——已實作為現行版本，尚未有業主明確覆核
- [ ] **Cumedy Night 的內容提示是否啟用** — 目前 `requiresConsent: true`，尚未被明確覆核（注意：這跟下面「持久化範圍」是兩個不同問題，持久化範圍已確認）
- [x] ~~內容提示層持久化範圍~~ — **已確認**（2026-09-15）：維持現狀，每次新分頁/重新造訪都要再進入一次
- [x] ~~是否在關於頁展示獲獎證書~~ — **已確認並上線**（2026-09-15）：公開展示，證書圖已上傳並關聯
- [x] ~~淺色主題次要語言對比度~~ — **已修復**（2026-09-15）：`light` 主題另外用 `0.65`，其餘維持 `0.55`；因三系列目前都不是 `light` 主題，沒有肉眼實測過
- [x] ~~部分區塊的暫定字級~~ — **維持工程端現值**（2026-09-15），業主指示可以推進、沒有提供新數字
- [ ] **Cumedy Night 成品照數量偏多**（33 張 → 建議精選 8–12 張）— 業主已表示要自己去後台 Block Editor 挑選編排（2026-09-15），非工程待辦，僅供追蹤是否已完成
- [ ] **三個系列的 `year`／`category`／`pieceCount` 目前完全是空的**，需要業主補資料才能在前台顯示年份/分類/件數等資訊——2026-09-19 這批新增的「統計數字區塊」（見 Phase 6 第 5 項）也要靠這三個欄位才會顯示東西，目前這個新區塊在前台等於還看不到
- [x] ~~三個系列目前 `visibility` 都是 `draft`~~ — **已於 2026-09-15 全部切成 `public`**，見 §3.1
- [x] ~~Hero 文字疊層的字體要不要換~~ — **已決定並實作**（2026-09-20，已 push）：
  - 混合模式：業主看過 `overlay`（白/深色區域幾乎消失）後，用暫時的網址參數比較四種處理，選定 **`mix-blend-mode: difference`**（暫時參數已刪除）。
  - 字體：業主要求「更藝術」，先試了 Syne + LXGW WenKai TC 楷體，業主看過說中文不好看；再給了 4 個中文候選（Noto Sans TC Bold／Black、LXGW Marker Gothic、Chocolate Classical Sans），業主沒有從中選，而是拿三張參考圖（手繪姓名字樣風格）問能不能做到——這些都是設計師手工繪製的字樣／商業字體，不在 Google Fonts，也不能從別人作品描字形。**最後選定方向 A：由業主（或字體設計師）自己畫姓名專屬字樣，工程端只做接線。** 目前文字退回顯示：英文 Syne Bold、中文 Noto Sans TC Bold、職稱同兩款（`src/app/hero-fonts.ts`，只套 Hero，不動全站字體）。原本討論的 Archivo／Space Grotesk／Familjen Grotesk／Bricolage Grotesque 沒有採用。
  - **專屬字樣已由工程端程式化生成並裝上（2026-09-20，業主非設計背景、只給參考圖、要求工程端代為產出）**：`public/brand/name-zh.svg`／`name-en.svg`，設定在 `src/lib/brand/name-logotype.ts`。做法：拿現有字體輪廓（中文 Noto Serif TC Black「曾昱睿」、英文 Abril Fatface「Tseng Yu Jui」，兩者皆 SIL OFL 開源授權，衍生輪廓可用）取樣成折線，套上程式化變形。**第一版（瘦長：垂直拉長 1.6／1.75 倍、腰身收窄 0.28／0.24）業主看過說「往內縮的感覺，想要更大方大氣」，已換掉**；現行版本相反——不拉長（中文 1.2／英文 1.12）、腰身反而微鼓（-0.09／-0.07）、上下端撐開 0.16／0.12、整體水平放大 1.1／1.06、字距與詞距加大避免碰撞。尺寸也加大：英文寬約 7.6em、中文在 EN 模式下高約 1.1em，並改成「以寬度為準、超出欄位自動縮小」（`width: min(100%, …em)`，h1 與每行 span 需 `w-full`），桌機 1440／1024／手機 390 都量過不超出欄位、無橫向捲動。**沒有複製參考圖的任何字形**，只借用「高對比明體＋拉長收腰」的風格方向。⚠️ 這是「變形過的現成字體」，不是手繪字樣，品質不如真正的設計師作品；業主若想升級，把設計師畫的去背 SVG 直接覆蓋 `public/brand/` 兩個檔案、改 `aspect` 即可，接線不用動。⚠️ 底稿是襯線體，偏離 SPEC §5.2「禁止襯線」——這是圖片形式的專屬字樣，且業主參考圖本身就是明體風格。生成腳本在對話暫存目錄，沒有進 repo；備用的第二組更激進變形（中文拉長 1.85／腰 0.34、英文拉長 2.0／腰 0.3）也沒有裝。用真實照片模擬 `difference` 混合看過：Cumedy 雜亂背景下讀得到（壓在白色領巾上的 `Yu` 對比較弱）、淨土淺色照片下反相成暖褐色。**還沒看過在真實瀏覽器畫面上的實際效果**。
  - （以下為當初留給設計師的接線規格說明，仍適用於日後替換）**專屬字樣接線**（`src/lib/brand/name-logotype.ts` 的 `NAME_LOGOTYPE`）：把去背的單色 SVG（或寬度 ≥ 2400px 的 PNG）放進 `public/brand/`，在該檔案填 `src`／`aspect`（寬÷高）／`heightEm`，中英各自獨立，設了就顯示字樣、沒設就退回文字。程式會用 CSS filter 統一轉白（`difference` 混合需要白色），真實姓名文字保留在 DOM 裡（`sr-only`，供 SEO／螢幕閱讀器），語言切換時字樣會跟著縮放。用臨時黑色測試 SVG 驗證過（載入、轉白、縮放比例、姓名文字仍在 DOM、無 console 錯誤），測試檔已刪除。**⚠️ 只驗證了程式行為，沒有實際看過真的字樣在畫面上的視覺效果**（等圖檔）。字樣圖必須去背，帶底色的圖會變成一塊白色矩形。系列頁標題也可以用同樣方式做（資料庫已有 `collections.titleImageId`），還沒接。
  - 同批修掉兩個 bug：(1) 姓名的 g 下伸部被滑入動畫的 `overflow-hidden` 遮罩切掉（補 padding + 負 margin）；(2) Hero 左欄包裝層寬度塌成 0，右欄蓋到左半邊、真正右半邊全黑（現在左右兩欄各包一層 `lg:w-1/2`）。第 (2) 個 bug 在前一輪「配對同系列」驗證時沒被抓到，因為當時只檢查了 z-index 與 r2Key 前綴，沒有量兩欄實際位置與寬度。
- [ ] **Cumedy Night 內容提示是否啟用 vs. 首頁封面 hover 曾經試過的 ASCII 效果**——這兩個問題都懸著（第一個原本就沒解決，第二個是業主看過 demo 後主動要求整個撤掉，已完整移除，見 Phase 6 第 8 項），下一個 session 不用主動重提 ASCII，除非業主自己想改變主意

---

## 6. 下一步具體指令

**（2026-10-22 更新）Phase 7 後台改版已 commit 並 push。**

### 6.0 新 session 的第一件事

1. 跟業主確認：Phase 7 後台看過了嗎？要調整什麼？**業主明確說「commit push」才 commit＋push**（commit 前照例 `tsc --noEmit`、`eslint src`、掃機密；`git status` 應該只有 Phase 7 的檔案＋`drizzle/0006_*`、`drizzle/meta/0006_snapshot.json`、`_journal.json`、HANDOFF.md、SPEC.md）。
2. push 之後用 Vercel 確認部署 READY，再實際開正式站 `/admin` 看一次（正式站只能用 magic link 登入，要請業主自己登入，或只檢查登入頁與前台）。
3. Phase 7 沒驗證到、建議找機會補的：真 iPhone／Safari 上的拖曳（長按拖曳只在 Chrome 觸控模擬驗證過）、實際上傳一張圖（驗證 XHR 進度條與「上傳到目前篩選的系列」，測完從面板刪除）、正式站 magic link 登入後是否導到 `/admin`。
4. 接下來的工作都是「業主看過之後的調整」或「等業主提供內容」（下面 6.1），不是既定的開發階段。

### 6.1 待業主決定／提供（新 session 開場時可以逐項確認進度）

1. ~~**Cumedy Night 的作品精選權**~~——**2026-10-22 已做**（Phase 7）：後台「系列 → 作品長廊」可以隱藏個別作品、拖曳排序。目前三個系列都還沒隱藏任何作品、沒有自訂順序（外觀跟以前一樣），等業主自己挑。
2. **Cumedy 圖片方向**：業主要自己在後台修正（Phase 7 之後：圖庫 → 點圖打開側邊面板 → 「旋轉 90°」）（按下去縮圖立刻轉、新網址是 `…~90` 這種版本前綴，§1.1 第 13 項）。之後如果業主說「旋轉後前台沒變」，先確認是不是瀏覽器快取，再看首頁/關於頁有沒有重新驗證。
3. **bio 簡介還是空的**（待業主提供；Phase 7 之後業主可以自己在「個人資料 → 簡介」填）：因此首頁的「捲動釘住簡介區塊」不會出現、導覽的「Bio」連結也刻意隱藏（`hasBio`）。填了之後兩者都會自動出現，**但那個釘住區塊從來沒有肉眼看過**。
4. `year`／`category`／`pieceCount` 三個系列都還是 `null`（系列頁左欄的資訊列因此不顯示）；**所有圖庫圖片的 alt 文字都是空的**（目前退回「系列名 — 類型 序號」）。Phase 7 之後業主可以自己補：系列 → 基本資料；圖庫 →「缺替代文字」篩選 → 點圖 → 用 ← → 連續補。後台「總覽」的待補資料清單會即時列出還缺什麼。
5. **姓名專屬字樣是程式化生成的**（現成字體變形，不是手繪，§1.1 第 6 項附近的 Hero 字樣段落）。如果業主找到設計師，把去背 SVG 覆蓋 `public/brand/name-en.svg`／`name-zh.svg` 並改 `src/lib/brand/name-logotype.ts` 的 `aspect` 即可，接線不用動。
6. **第一次來訪引導（第 17 項）還沒有真人測試驗證**——是憑審計與慣例判斷的。等測試者回饋；可能要調整：首屏輪播自動換圖會不會太吵、Cumedy 內容提示層（一片黑加警語）要不要加說明。
7. Preview 專用的獨立 Turso/R2（SPEC §1.2 建議，目前跟 Production 共用，非必要）。

### 6.2 給新 session 的工作方式提醒（都是這幾天踩過的坑）

- **不要在業主沒說「commit push」前 push。** 每次 push 都是業主明確同意；commit 前跑 `tsc --noEmit`、`eslint src`、掃機密。
- **驗證視覺一定要用真實裝置模擬**：瀏覽器面板（`mcp__Claude_Browser__*`）常是隱藏狀態，截圖是空白、`requestAnimationFrame`／CSS 轉場／懶載入／`IntersectionObserver` 都不會跑。可靠的做法是在對話暫存目錄 `npm i puppeteer-core`（不進專案）＋本機 Chrome（`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`），`page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true})` 截圖再用 Read 看。⚠️ 純 `chrome --headless --window-size=390` **不準**（視窗最小寬約 500px，畫面是裁的）。**驗證圖片要用大視窗＋高解析度**，小視窗會掩蓋「缺 1600/2400 變體」這類問題（§1.1 第 14 項）。
- **開發伺服器**：`.claude/launch.json` 的 `dev` 在 3050 埠，用 `preview_start {name:"dev"}` 啟動（不要用 Bash 跑）；跑一連串 puppeteer 之後偶爾會卡住（60 秒無回應），`preview_stop` 再 `preview_start` 即可。專案根目錄執行 DB/R2 腳本用 `npx tsx --env-file=.env.local ./_tmp-xxx.mts`（`.mts` 才能用頂層 await，腳本要放專案根目錄才解析得到 `drizzle-orm`，跑完刪掉）。
- **後台本機登入**：登入頁的「本機測試登入」按鈕（只在非 production 顯示，正式站不存在）。
- **動真實資料前先看目標**：曾差點拿「沒有指派系列」的圖當測試，結果那是關於頁正在公開展示的證書。測試資料用臨時上傳的圖，測完從後台刪除（刪除會清掉所有旋轉狀態的變體與原檔）。對 R2 做新增類的補檔（如補缺的尺寸）是可以的，但要先說明範圍。
- **不要複製參考網站的內容**：只借用版面手法（aoiofficial.com 的分析在 §1.1 Phase 6 第 9 項附近），不用對方的文案、圖片、字形。
- **後台測試要備份再還原**（Phase 7）：本機與正式站共用同一個 Turso，任何寫入測試先用臨時腳本把相關資料表整份讀出來存檔，測完用後台介面還原，再逐欄比對。puppeteer 在 macOS 的 ⌘A 不會全選輸入框（要清空請 End＋多次 Backspace）。登入用登入頁最後一顆「本機測試登入」按鈕。
- **不要在包住內容的元素上留 transform**：`animation-fill-mode: both`（或任何殘留的 transform／filter／backdrop-filter）會讓該元素變成 `position: fixed` 子元素的定位基準——拖曳浮層、底部儲存列都會跑位（Phase 7 實測踩到）。
- **SPEC 有幾處刻意偏離**（都記在 HANDOFF 對應項目裡）：雙語次要語言在整段敘述/按鈕改 0.85em（SPEC §6.1 是 0.55em）；姓名字樣底稿用襯線體（SPEC §5.2 禁止襯線，但那是圖片）；圖片變體四個尺寸一律生成（SPEC §1.3 原本說小圖跳過，已改）。

**沒有實測的一點**：`prefers-reduced-motion` 開啟時**前台**的首屏輪播、系列頁三種進場動畫、抖動、導覽收起是否真的停用——只確認過 CSS／程式碼邏輯。（首頁跑馬燈與**後台**的動畫已用 puppeteer 模擬 reduced-motion 實測過。）

---

## 7. SEO / AI 爬取基礎架構（第八批已實作，本節內容變成落地紀錄）

以下原本是規劃清單，第八批（見 §1.1）已經照這裡的規劃全部實作完成——llms.txt 動態產生於 `src/app/llms.txt/route.ts`，schema.org 對應表落地在 `src/lib/seo.ts` 的 `buildPersonJsonLd()`/`buildCreativeWorkJsonLd()`。保留原始規劃內容當作設計依據紀錄，不重寫。

### 7.1 llms.txt 內容清單（已落地，見 `src/app/llms.txt/route.ts`）

依 [llmstxt.org](https://llmstxt.org) 慣例的結構規劃：

```
# Tseng Yu Jui — Fashion Designer Portfolio

> 一行站台摘要（曾昱睿，服裝設計師，作品集網站）

## Pages
- /：首頁 — Hero、精選系列列表（含摘要段落）、簡短 bio
- /work/cumedy-night：未完待酗 / Cumedy Night 系列（statementEn 摘要）
- /work/pure-land：在最後的淨土上孤獨系列（statementEn 摘要）
- /work/x-venom：X-venom 系列（statementEn 摘要）
- /about：完整 bio、比賽經歷、聯絡方式

## Notes
- 雙語內容：英文為主、中文為輔，兩者都在頁面 HTML 裡（SPEC §6）
- 草稿/未發布的系列不會出現在這份清單裡，直接連結也是 404
```

**已決策並落地**：只收 `visibility === 'public'` 且已發布（`publishedSnapshot IS NOT NULL`）的系列，`unlisted` 不列（跟上面「待確認」段落當初傾向的方向一致，第八批直接照這個方向實作，見 `src/app/llms.txt/route.ts`）。

### 7.2 schema.org 欄位對應表（已落地，見 `src/lib/seo.ts`）

**`Person`**（首頁/關於頁，對應 `profile` 表）：

| schema.org 欄位 | 資料庫欄位 | 備註 |
|---|---|---|
| `name` | `profile.nameEn` | 主要語言用英文 |
| `alternateName` | `profile.nameZh` | |
| `jobTitle` | `profile.roleEn`/`roleZh` | |
| `homeLocation` | `profile.locationEn`/`locationZh` | 選 `homeLocation` 不選 `address`——`address` 隱含要給結構化 `PostalAddress`，語意上太重；這裡只是鬆散的「所在城市/地區」資訊，`homeLocation`（`Place`）比較貼切，見 `src/lib/seo.ts` 註解 |
| `description` | `profile.bioEn`/`bioZh` | |
| `email` | `profile.email` | |
| `sameAs` | `[profile.instagram, profile.behance]` | 陣列，過濾掉空值 |
| `image` | `profile.defaultOgImageId ?? profile.heroImageId` 解析出的圖片網址 | 實作時多接了 `defaultOgImageId` 當第一優先——這個欄位本來就是「業主指定的預設分享圖」，比 Hero 背景圖更準確地代表「這個人的形象照」，`heroImageId` 只在沒設 `defaultOgImageId` 時當備援 |
| `url` | `NEXT_PUBLIC_SITE_URL` | 不可硬編碼網域，沿用 SPEC §1.2 原則 |

**`CreativeWork`**（每個系列頁 `/work/[slug]`，對應 `collections` 表；型別待定，`CreativeWork` 最保守，也可以考慮更精確的 `Collection` 或 `VisualArtwork`，需要業主/SEO 顧問確認哪個對搜尋引擎理解服裝作品集更有利）：

| schema.org 欄位 | 資料庫欄位 | 備註 |
|---|---|---|
| `name` | `collections.titleEn` | |
| `alternateName` | `collections.titleZh` | 對應表原本沒列這行，實作時比照 `Person` 的 `name`/`alternateName` 慣例補上，非必要可拿掉 |
| `description` | `collections.statementEn` | |
| `dateCreated` | `collections.year` | 目前三個系列這欄位都是 `null`，**實際輸出會直接省略這個屬性**，不是輸出空字串（見下方說明） |
| `creator` | 連結到上面的 `Person`（`{"@type":"Person","name":...,"url":...}`，精簡版，不是完整 `Person` 物件） | |
| `image` | `collections.ogImageId ?? collections.coverImageId` 解析出的圖片網址 | |
| `url` | `${NEXT_PUBLIC_SITE_URL}/work/${collections.slug}` | |
| `genre` | `collections.category` | 目前也是 `null`，**實際輸出省略** |
| `numberOfItems` | `collections.pieceCount` | 若改用 `Collection`/`ImageGallery` 型別才有意義（`CreativeWork` 官方沒有這個屬性），這個不精確第八批照舊實作、沒有重新設計範圍；目前也是 `null`，**實際輸出省略** |

**已落地**：`dateCreated`/`genre`/`numberOfItems` 對應的 `year`/`category`/`pieceCount` 目前三個系列都是 `null`——`buildCreativeWorkJsonLd()`（`src/lib/seo.ts`）遇到 `null` 會直接不輸出該屬性（不是輸出 `null`/`""`），業主補齊 SPEC §10.3 待補清單裡的這三個欄位後，這三個屬性會自動出現在 JSON-LD 裡，不需要再改程式碼。

---

*本文件不含任何憑證明文（token、secret、key），僅描述「哪個變數已填」。*
