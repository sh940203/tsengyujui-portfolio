"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 跟 src/auth.ts 的 SESSION_MAX_AGE_SECONDS 一致

/**
 * 本機測試專用的登入捷徑（2026-09-19，業主要求「先把 admin 改簡單一點
 * 方便現在測試，上線前再把安全強度加回去」）。
 *
 * 刻意設計成**不需要記得之後拿掉**：第一行就擋 production——
 * `NODE_ENV` 在 Vercel production 部署下一定是 `"production"`
 * （Next.js 內建行為，不是本專案自訂的環境變數，不會因為業主忘記改
 * 設定而失效），所以這個入口在正式站永遠無效，不會變成正式站的後門，
 * 不像「先關掉再記得開回來」那種需要業主自己記住時機的做法。
 *
 * 做的事：直接在 `sessions` 表建一筆紀錄、設對應的 session cookie，
 * 效果等同過去 HANDOFF.md 記錄的手動測試方式（直接插入 session 列 +
 * 設 cookie），差別是這裡自動化成一顆按鈕，不用每次手動下 SQL。
 * Cookie 名稱 `authjs.session-token` 是 Auth.js v5 在 `secure: false`
 * （本機開發，見 `src/auth.ts` 的 cookies 設定）時的預設命名，沒有另外
 * 客製過，跟正常 Magic Link 登入流程產生的 session 完全相容——之後
 * 系列頁、Block Editor 等既有的 `requireAuth()`/`auth()` 呼叫不需要
 * 知道這個 session 是怎麼建立的。
 *
 * 登入對象固定是資料庫裡第一筆 `users`——目前這個專案只有一位使用者
 * （業主本人），之後如果真的有第二個帳號要各自測試，才需要改成可選
 * 使用者，現在不先做這個彈性。
 */
export async function devLogin() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("devLogin is not available in production");
  }

  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  if (!user) {
    throw new Error(
      "找不到任何 users 列——請先走一次正常的 Magic Link 登入流程一次，讓 Auth.js 建立你的 users 列，之後才能用這顆捷徑。",
    );
  }

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_MS);

  await db.insert(sessions).values({ sessionToken, userId: user.id, expires });

  const cookieStore = await cookies();
  cookieStore.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    expires,
  });

  redirect("/admin");
}
