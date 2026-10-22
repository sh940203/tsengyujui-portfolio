import type { Metadata } from "next";
import { auth } from "@/auth";
import { zhFont } from "@/components/blocks/render/fonts";
import { AdminShell } from "@/components/admin/shell";

export const metadata: Metadata = {
  title: { default: "後台", template: "%s — 後台" },
  robots: { index: false, follow: false },
};

/**
 * 後台共用外框（2026-10-22）。登入與否仍由每一頁自己的 `auth()`＋redirect、每支 server
 * action 的 `requireAuth()` 把關（SPEC §12.2：外框不是防線）；這裡只拿信箱顯示在側邊欄。
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className={`admin-root ${zhFont.variable} min-h-dvh w-full bg-stone-100 text-stone-900`}>
      <AdminShell email={session?.user?.email ?? null}>{children}</AdminShell>
    </div>
  );
}
