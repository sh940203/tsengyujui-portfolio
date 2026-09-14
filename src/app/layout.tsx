import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GENERIC_SITE_DESCRIPTION, SITE_URL } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * 全站預設 metadata（SPEC.md §8.1）。個別頁面（首頁／關於頁／
 * `/work/[slug]`）用各自的 `generateMetadata` 覆蓋 `title`/`description`；
 * 這裡的值是「連個別頁面都沒設時」的最後一層保底，同時也是 `template`
 * 套用的基準（例如關於頁只需要回傳 `title: "About"`，會自動變成
 * "About — Tseng Yu Jui"）。`metadataBase` 沒設時 Next 會在 build log
 * 印警告並退回本機網址——`NEXT_PUBLIC_SITE_URL` 目前線上環境還沒填
 * （見 HANDOFF.md §2.1），正式上線前必須補上，否則 OG/sitemap 等網址
 * 會是相對路徑或本機網址。
 */
export const metadata: Metadata = {
  metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
  title: {
    default: "Tseng Yu Jui — Fashion Designer",
    template: "%s — Tseng Yu Jui",
  },
  description: GENERIC_SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
