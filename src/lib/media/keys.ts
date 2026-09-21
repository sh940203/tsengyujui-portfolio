/**
 * 旋轉後的公開變體網址規則（2026-09-21）。
 *
 * 問題：後台旋轉原本把新的變體覆蓋在**同一個網址**上，而變體是
 * `Cache-Control: immutable, max-age=1 年`——瀏覽器/CDN 不會重新抓，所以旋轉後
 * 縮圖（與前台）看起來完全沒變，重新整理也可能還是舊圖。
 *
 * 做法：旋轉後把變體放到**新的前綴** `${base}~${rotation}`，資料庫的
 * `media.r2Key` 改指向它。前台/後台所有地方都是讀資料庫的 `r2Key` 組網址，
 * 一改就全部同步，不用一個個加版本參數。網址與內容一對一（同一個前綴的內容
 * 永遠是同一個旋轉角度），所以永久快取是安全的。
 *
 * 原檔（私有 bucket）永遠留在**基底前綴** `${base}/original.*`，不隨旋轉搬家。
 * 從沒旋轉過的圖（包含匯入時就帶 rotation 的手繪稿）`r2Key` 就是基底本身。
 */
export type RotationDeg = 0 | 90 | 180 | 270;

export const ROTATION_STATES: readonly RotationDeg[] = [0, 90, 180, 270];

const SUFFIX_RE = /~(?:0|90|180|270)$/;

/** 拿掉旋轉後綴，回到原檔所在的基底前綴。 */
export function baseKeyOf(r2Key: string): string {
  return r2Key.replace(SUFFIX_RE, "");
}

/** 某個旋轉角度的公開變體前綴。 */
export function versionedKey(baseKey: string, rotation: RotationDeg): string {
  return `${baseKey}~${rotation}`;
}
