import { asc } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { collections } from "@/lib/db/schema";

export default async function AdminCollectionsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  const rows = await db
    .select()
    .from(collections)
    .orderBy(asc(collections.sortOrder));

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-medium">系列</h1>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">slug</th>
            <th className="py-2">標題</th>
            <th className="py-2">theme</th>
            <th className="py-2">visibility</th>
            <th className="py-2">requiresConsent</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b">
              <td className="py-2">{c.slug}</td>
              <td className="py-2">
                {c.titleZh ?? c.titleEn}
                {c.titleZh && <span className="text-neutral-400"> / {c.titleEn}</span>}
              </td>
              <td className="py-2">{c.theme}</td>
              <td className="py-2">{c.visibility}</td>
              <td className="py-2">{c.requiresConsent ? "true" : "false"}</td>
              <td className="py-2">
                <Link href={`/admin/collections/${c.id}`} className="underline">
                  編輯
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
