import { signIn } from "@/auth";
import { AuthCard } from "@/components/admin/auth-card";
import { buttonClass } from "@/components/admin/ui/styles";
import { devLogin } from "./dev-login-action";

export const metadata = { title: "登入" };

export default function AdminLoginPage() {
  // NODE_ENV 是 Next.js 內建行為，Vercel production 部署一定是
  // "production"，不會因為忘記關掉而讓這顆按鈕出現在正式站——見
  // `dev-login-action.ts` 的說明。
  const showDevLogin = process.env.NODE_ENV !== "production";

  return (
    <AuthCard title="後台登入" description="輸入你的信箱，我們會寄一封登入連結給你。連結 10 分鐘內有效、只能用一次。">
      <form
        action={async (formData) => {
          "use server";
          await signIn("nodemailer", formData);
        }}
        className="mt-6 flex flex-col gap-3"
      >
        {/*
          沒有這個欄位時，Auth.js 的 signIn() 會把 callbackUrl 預設成
          `Referer` header（拿不到時才 fallback "/"）——實測發現這條路徑不
          可靠，登入成功後被導到公開首頁而不是後台，讓人誤以為登入失敗
          去重複點同一個一次性連結（第二次當然顯示「登入失敗」，那是
          token 單次使用的正常保護，不是 bug）。明確指定 redirectTo，
          next-auth 的 signIn server action 會直接從 formData 讀這個欄位
          （見 node_modules/next-auth/lib/actions.js），不依賴 Referer。
          2026-10-22：改導去 /admin（後台總覽，這次改版才實作）。原本導去 /admin/collections 是因為 SPEC.md §7.1 定義的
          /admin 儀表板路由實際上從未實作（`src/app/admin/` 底下只有
          awards/collections/media/profile/login 五個子路由，沒有
          `page.tsx`），/admin/collections 是實際存在、後台最主要的
          工作入口。
        */}
        <input type="hidden" name="redirectTo" value="/admin" />
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-stone-800">信箱</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none transition-[border-color,box-shadow] placeholder:text-stone-400 hover:border-stone-400 focus:border-stone-900 focus:ring-4 focus:ring-stone-900/[0.07]"
          />
        </label>
        <button type="submit" className={buttonClass("primary", "md", "h-11 w-full")}>
          寄送登入連結
        </button>
      </form>

      {showDevLogin && (
        <form action={devLogin} className="mt-6 border-t border-dashed border-stone-200 pt-5">
          <p className="mb-3 text-xs leading-relaxed text-amber-700">
            本機測試捷徑（只在開發環境顯示，正式站不會出現）——跳過寄信，直接用資料庫裡的第一位使用者登入。
          </p>
          <button type="submit" className={buttonClass("secondary", "md", "w-full border-amber-300 text-amber-800 hover:border-amber-400 hover:bg-amber-50")}>
            本機測試登入（跳過寄信）
          </button>
        </form>
      )}
    </AuthCard>
  );
}
