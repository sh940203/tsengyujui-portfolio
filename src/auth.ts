import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { db } from "@/lib/db/client";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/lib/db/schema";

const MAGIC_LINK_MAX_AGE_SECONDS = 10 * 60; // 10 分鐘 — SPEC.md §12.2
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 天
const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60; // 24 小時

function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_LOGIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email: string | null | undefined): boolean {
  return getAllowedEmails().includes(email?.toLowerCase() ?? "");
}

// ── 白名單判斷刻意不放在 signIn callback ──────────────────────────────
//
// 舊實作讓 signIn callback 對非白名單信箱回傳 false，Auth.js 對此的處理是
// 直接 throw AccessDenied、跳過 token 產生，整段導向 /admin/login/error；
// 白名單內的信箱則正常導向 /api/auth/verify-request。兩條路徑的「回覆」
// 從第一個位元組就不同，等於還是能用來枚舉哪些信箱在白名單——即使錯誤頁
// 文字本身寫得再通用也沒用（實測驗證過這個落差是真的）。
//
// Auth.js 內部（send-token.js）在 signIn 通過後，是用
// `Promise.all([sendVerificationRequest(...), adapter.createVerificationToken(...)])`
// 平行呼叫寄信與寫入 token，兩者互不等待、互不感知對方結果，最後固定回傳
// 同一個 /verify-request 導向。這代表只把白名單判斷搬進
// sendVerificationRequest、裡面 return 不寄信，並不足夠：
// createVerificationToken 是另一條平行路徑，不會因為 sendVerificationRequest
// 內部悄悄跳過寄信就跟著不寫資料庫。若只改 sendVerificationRequest，
// 非白名單信箱一樣會在 verification_tokens 留下一筆紀錄，只是沒收到信。
//
// 所以這裡讓 signIn 一律回傳 true（重導向永遠一致），並且在兩個真正各自
// 獨立執行的地方都各自加白名單判斷：
//   - adapter.createVerificationToken：非白名單直接 return，不寫入資料庫
//   - provider.sendVerificationRequest：非白名單直接 return，不寄信
// 兩邊各自把關，才會同時滿足「重導向一致」與「不在白名單者完全不留痕跡」。

const baseAdapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

const adapter: typeof baseAdapter = {
  ...baseAdapter,
  async createVerificationToken(data) {
    if (!isAllowedEmail(data.identifier)) return undefined as never;
    return baseAdapter.createVerificationToken!(data);
  },
};

const nodemailerProvider = Nodemailer({
  // 未設定真實 SMTP 前的預設值，避免建置期因缺少憑證而中斷；
  // 實際寄信仍需在 .env.local 填入正式的 EMAIL_SERVER / EMAIL_FROM
  server: process.env.EMAIL_SERVER || "smtp://localhost:1025",
  from: process.env.EMAIL_FROM || "no-reply@localhost",
  maxAge: MAGIC_LINK_MAX_AGE_SECONDS,
});
const defaultSendVerificationRequest =
  nodemailerProvider.sendVerificationRequest!.bind(nodemailerProvider);
nodemailerProvider.sendVerificationRequest = async (params) => {
  if (!isAllowedEmail(params.identifier)) return; // 不在白名單：靜默不寄信
  return defaultSendVerificationRequest(params);
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  providers: [nodemailerProvider],
  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    // 一律允許——實際的白名單把關在上面的 adapter.createVerificationToken
    // 與 sendVerificationRequest，兩種情況才會走到完全相同的重導向路徑。
    async signIn() {
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as typeof users.$inferSelect).role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/admin/login",
    verifyRequest: "/admin/login/check-email",
    error: "/admin/login/error",
  },
});
