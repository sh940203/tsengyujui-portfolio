"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signOutAction } from "@/app/admin/sign-out-action";
import { FeedbackProvider } from "./ui/feedback";
import {
  IconExternal,
  IconHome,
  IconImage,
  IconLayers,
  IconLogout,
  IconMenu,
  IconTrophy,
  IconUser,
  IconX,
} from "./ui/icons";
import { cn } from "./ui/primitives";

/**
 * 後台外框（2026-10-22）。原本後台完全沒有導覽——各頁之間只能自己打網址、沒有後台首頁、
 * 手機上也不能用。現在：
 * - 桌機（≥1024px）：左側固定導覽列
 * - 手機/平板：頂部列＋從左滑出的導覽抽屜（換頁後自動收起）
 * - 換頁時內容區淡入（`key={pathname}`），配合各路由的 `loading.tsx` 骨架，按下去立刻有反應
 * - 登入頁與區塊編輯器的預覽 iframe 不套外框
 */

const NAV = [
  { href: "/admin", label: "總覽", icon: IconHome, exact: true },
  { href: "/admin/collections", label: "系列", icon: IconLayers },
  { href: "/admin/media", label: "圖庫", icon: IconImage },
  { href: "/admin/profile", label: "個人資料", icon: IconUser },
  { href: "/admin/awards", label: "比賽經歷", icon: IconTrophy },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="後台" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href, "exact" in item ? item.exact : false);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150",
              active ? "bg-stone-900/[0.06] font-medium text-stone-900" : "text-stone-500 hover:bg-stone-900/[0.04] hover:text-stone-900",
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-stone-900 transition-[opacity,transform] duration-200",
                active ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0",
              )}
              aria-hidden="true"
            />
            <Icon size={18} className={active ? "text-stone-900" : "text-stone-400 group-hover:text-stone-700"} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 rounded-lg px-1 py-1">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-stone-900 text-[13px] font-semibold tracking-tight text-white">
        TY
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-stone-900">曾昱睿</span>
        <span className="block text-[11px] text-stone-500">作品集後台</span>
      </span>
    </Link>
  );
}

function SidebarFooter({ email }: { email: string | null }) {
  return (
    <div className="flex flex-col gap-1 border-t border-stone-200/80 pt-3">
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-stone-500 transition-colors hover:bg-stone-900/[0.04] hover:text-stone-900"
      >
        <IconExternal size={18} className="text-stone-400" />
        查看網站
      </a>
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-stone-500 transition-colors hover:bg-stone-900/[0.04] hover:text-stone-900"
        >
          <IconLogout size={18} className="text-stone-400" />
          登出
        </button>
      </form>
      {email && <p className="truncate px-3 pt-1 text-[11px] text-stone-400">{email}</p>}
    </div>
  );
}

export function AdminShell({ email, children }: { email: string | null; children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const bare = pathname.startsWith("/admin/login") || pathname.endsWith("/preview");

  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [drawerOpen]);

  if (bare) return <>{children}</>;

  const current = NAV.find((item) => isActive(pathname, item.href, "exact" in item ? item.exact : false));

  return (
    <FeedbackProvider>
      {/* 桌機側邊欄 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-stone-200/80 bg-white/70 px-3 py-5 backdrop-blur-xl lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks pathname={pathname} />
        </div>
        <SidebarFooter email={email} />
      </aside>

      {/* 手機頂部列 */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-stone-200/80 bg-white/80 px-2 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="開啟選單"
          aria-expanded={drawerOpen}
          className="grid h-10 w-10 place-items-center rounded-lg text-stone-700 transition-colors hover:bg-stone-100"
        >
          <IconMenu size={20} />
        </button>
        <span className="text-[15px] font-semibold text-stone-900">{current?.label ?? "後台"}</span>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          aria-label="查看網站"
          className="ml-auto grid h-10 w-10 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
        >
          <IconExternal size={18} />
        </a>
      </header>

      {/* 手機導覽抽屜 */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", drawerOpen ? "" : "pointer-events-none")} aria-hidden={!drawerOpen}>
        <div
          className={cn(
            "absolute inset-0 bg-stone-950/30 transition-opacity duration-300",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setDrawerOpen(false)}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col gap-6 bg-white px-3 py-4 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between px-2">
            <Brand />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="關閉選單"
              tabIndex={drawerOpen ? 0 : -1}
              className="grid h-10 w-10 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
            >
              <IconX size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <NavLinks pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </div>
          <SidebarFooter email={email} />
        </div>
      </div>

      <div className="lg:pl-64">
        <main key={pathname} className="admin-page-in mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10">
          {children}
        </main>
      </div>
    </FeedbackProvider>
  );
}
