/**
 * 中文標題跟英文標題一樣（例如 X-venom 的 `titleZh` 也是 "X-venom"）就不要
 * 顯示第二次——雙語標題會把兩個一樣的字疊成一大一小，看起來像重複。
 */
export function zhTitleForDisplay(titleEn: string, titleZh: string | null): string {
  if (!titleZh) return "";
  return titleZh.trim().toLowerCase() === titleEn.trim().toLowerCase() ? "" : titleZh;
}
