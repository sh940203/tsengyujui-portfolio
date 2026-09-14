import { NextResponse } from "next/server";

// SPEC.md §12.7 — CSP 先以 Report-Only 上線觀察，確認無誤報後再改為強制模式
// （見 Phase 5 §30）。/admin 的登入保護屬於 Phase 2 §9，此檔案暫不處理。
function buildCsp(nonce: string): string {
  const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL ?? "";

  return [
    "default-src 'self'",
    `img-src 'self' data: blob: ${r2PublicUrl}`,
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' fonts.gstatic.com",
    `connect-src 'self' ${r2PublicUrl} ${upstashUrl}`,
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function middleware() {
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const res = NextResponse.next();
  res.headers.set("x-nonce", nonce);
  res.headers.set("Content-Security-Policy-Report-Only", buildCsp(nonce));
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
