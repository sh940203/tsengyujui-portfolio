import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { media, profile } from "@/lib/db/schema";
import { ProfileEditForm } from "./profile-edit-form";

export default async function AdminProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  const [profileRow] = await db
    .select()
    .from(profile)
    .where(eq(profile.id, "singleton"))
    .limit(1);

  const mediaRows = await db
    .select({ id: media.id, filename: media.filename, kind: media.kind })
    .from(media);

  if (!profileRow) {
    // seed-content.ts 應該已經建過這筆單一紀錄；理論上不會發生
    throw new Error("profile singleton 尚不存在，請先執行 pnpm run seed");
  }

  return <ProfileEditForm profile={profileRow} mediaOptions={mediaRows} />;
}
