import { signIn } from "@/auth";
import { devLogin } from "./dev-login-action";

export default function AdminLoginPage() {
  // NODE_ENV 是 Next.js 內建行為，Vercel production 部署一定是
  // "production"，不會因為忘記關掉而讓這顆按鈕出現在正式站——見
  // `dev-login-action.ts` 的說明。
  const showDevLogin = process.env.NODE_ENV !== "production";

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-medium">後台登入</h1>
      <p className="mt-2 text-sm text-neutral-500">
        輸入白名單信箱，我們會寄一封 10 分鐘內有效的登入連結給你。
      </p>
      <form
        action={async (formData) => {
          "use server";
          await signIn("nodemailer", formData);
        }}
        className="mt-4 flex flex-col gap-2"
      >
        {/*
          沒有這個欄位時，Auth.js 的 signIn() 會把 callbackUrl 預設成
          `Referer` header（拿不到時才 fallback "/"）——實測發現這條路徑不
          可靠，登入成功後被導到公開首頁而不是後台，讓人誤以為登入失敗
          去重複點同一個一次性連結（第二次當然顯示「登入失敗」，那是
          token 單次使用的正常保護，不是 bug）。明確指定 redirectTo，
          next-auth 的 signIn server action 會直接從 formData 讀這個欄位
          （見 node_modules/next-auth/lib/actions.js），不依賴 Referer。
          導去 /admin/collections 而不是 /admin——SPEC.md §7.1 定義的
          /admin 儀表板路由實際上從未實作（`src/app/admin/` 底下只有
          awards/collections/media/profile/login 五個子路由，沒有
          `page.tsx`），/admin/collections 是實際存在、後台最主要的
          工作入口。
        */}
        <input type="hidden" name="redirectTo" value="/admin/collections" />
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded border px-3 py-2">
          寄送登入連結
        </button>
      </form>

      {showDevLogin && (
        <form action={devLogin} className="mt-6 border-t pt-4">
          <p className="mb-2 text-xs text-amber-600">
            本機測試捷徑（只在開發環境顯示，正式站不會出現）——跳過寄信，直接用資料庫裡的第一位使用者建立 session。
          </p>
          <button type="submit" className="rounded border border-amber-500 px-3 py-2 text-amber-600">
            本機測試登入（跳過寄信）
          </button>
        </form>
      )}
    </main>
  );
}
