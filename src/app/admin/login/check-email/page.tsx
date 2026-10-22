import { AuthCard } from "@/components/admin/auth-card";
import { buttonClass } from "@/components/admin/ui/styles";

export const metadata = { title: "請查看信箱" };

export default function CheckEmailPage() {
  return (
    <AuthCard
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      }
      title="請查看你的信箱"
      description="登入連結已寄出，10 分鐘內有效、只能使用一次。沒收到的話，看看垃圾郵件匣。"
    >
      <a href="/admin/login" className={buttonClass("secondary", "md", "mt-6 w-full")}>
        重新寄送
      </a>
    </AuthCard>
  );
}
