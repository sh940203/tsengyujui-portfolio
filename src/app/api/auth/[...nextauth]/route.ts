import { NextResponse, type NextRequest } from "next/server";
import { handlers } from "@/auth";
import { loginRateLimit } from "@/lib/rate-limit";

export const { GET } = handlers;

// 送出 Magic Link 的請求需先過速率限制，避免對任意信箱狂發登入信
// （信箱轟炸 / SMTP 額度耗盡）— SPEC.md §12.3
export async function POST(req: NextRequest) {
  if (req.nextUrl.pathname.endsWith("/api/auth/signin/nodemailer")) {
    const formData = await req.clone().formData();
    const email = String(formData.get("email") ?? "").toLowerCase();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    const { success } = await loginRateLimit.limit(`${ip}:${email}`);
    if (!success) {
      return NextResponse.redirect(
        new URL("/admin/login?error=RateLimited", req.url),
      );
    }
  }

  return handlers.POST(req);
}
