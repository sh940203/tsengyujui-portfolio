import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// 登入請求（送出 Magic Link）— 5 次 / 10 分鐘，依 IP + email — SPEC.md §12.3
export const loginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "10 m"),
  prefix: "ratelimit:login",
});

// 檔案上傳 — 30 次 / 10 分鐘，依 user id
export const uploadRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "10 m"),
  prefix: "ratelimit:upload",
});

// 其他 admin 寫入操作 — 100 次 / 分鐘，依 user id
export const adminWriteRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  prefix: "ratelimit:admin-write",
});
