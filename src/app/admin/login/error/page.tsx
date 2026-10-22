import { AuthCard } from "@/components/admin/auth-card";
import { buttonClass } from "@/components/admin/ui/styles";

export const metadata = { title: "登入失敗" };

export default async function LoginErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // 登入失敗訊息不區分「信箱不存在」與「不在白名單」，一律顯示同一段文字，
  // 避免帳號枚舉 — SPEC.md §12.9
  return (
    <AuthCard
      title="登入失敗"
      description="連結無效、已過期，或此信箱沒有登入權限。請確認信箱後重新登入。"
    >
      {error && <p className="mt-2 text-xs text-stone-400">（{error}）</p>}
      <a href="/admin/login" className={buttonClass("primary", "md", "mt-6 w-full")}>
        回到登入頁
      </a>
    </AuthCard>
  );
}
