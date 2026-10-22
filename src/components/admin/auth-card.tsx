import Link from "next/link";
import type { ReactNode } from "react";

/** 登入相關頁面（登入、請查看信箱、登入失敗）共用的置中卡片。這幾頁不套後台外框。 */
export function AuthCard({ icon, title, description, children }: { icon?: ReactNode; title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="admin-page-in w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-stone-900 text-sm font-semibold tracking-tight text-white">TY</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-stone-900">曾昱睿</span>
            <span className="block text-[11px] text-stone-500">作品集後台</span>
          </span>
        </div>
        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(28,25,23,0.04),0_12px_32px_-12px_rgba(28,25,23,0.12)] sm:p-8">
          {icon && <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-stone-100 text-stone-600">{icon}</div>}
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h1>
          {description && <p className="mt-2 text-sm leading-relaxed text-stone-500">{description}</p>}
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-stone-400">
          <Link href="/" className="transition-colors hover:text-stone-700">
            ← 回到網站
          </Link>
        </p>
      </div>
    </main>
  );
}
