import "server-only";
import { auth } from "@/auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("FORBIDDEN");
  }
}

/**
 * SPEC.md §12.2 — 每個 Server Action / Route Handler 開頭都必須呼叫這個，
 * 不得只靠 middleware 判斷是否登入。
 */
export async function requireAuth(role?: "owner" | "admin") {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (role === "admin" && session.user.role !== "admin") {
    throw new ForbiddenError();
  }
  return session;
}
