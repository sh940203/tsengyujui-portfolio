/** 系列的公開狀態與主題在後台的顯示文字（原本直接顯示 `public`/`draft`/`void` 這種代碼）。 */

export const VISIBILITY_META = {
  public: { label: "公開", tone: "green", description: "出現在首頁列表，搜尋引擎可以找到" },
  unlisted: { label: "限連結", tone: "amber", description: "不出現在列表，只有拿到網址的人看得到" },
  draft: { label: "草稿", tone: "neutral", description: "前台完全看不到，只有後台看得到" },
} as const;

export const THEME_META = {
  dark: { label: "深色", swatch: ["#0A0A0A", "#E8E8E8"], style: "閃燈拼貼", description: "深底白字。作品緊貼交錯、閃燈式進場（Cumedy Night 的節奏）" },
  light: { label: "淺色", swatch: ["#F2F3F4", "#111111"], style: "一屏一件", description: "極淺底黑字。每件作品獨佔一屏、緩慢浮現（淨土的節奏）" },
  void: { label: "純黑", swatch: ["#000000", "#FFFFFF"], style: "感染擴散", description: "純黑底白字。越往下作品邊緣越尖刺、斑點越多（X-venom 的節奏）" },
} as const;

export type Visibility = keyof typeof VISIBILITY_META;
export type Theme = keyof typeof THEME_META;
