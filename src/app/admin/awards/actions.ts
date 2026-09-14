"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";
import { awards } from "@/lib/db/schema";

const UpdateAwardImageSchema = z.object({
  awardId: z.string().cuid2(),
  imageId: z.string().cuid2().nullable(),
});

export async function updateAwardImage(input: {
  awardId: string;
  imageId: string | null;
}): Promise<void> {
  await requireAuth();
  const { awardId, imageId } = UpdateAwardImageSchema.parse(input);

  await db.update(awards).set({ imageId }).where(eq(awards.id, awardId));

  revalidatePath("/admin/awards");
  revalidatePath("/about");
}

const UpdateAwardShowCertificateSchema = z.object({
  awardId: z.string().cuid2(),
  showCertificate: z.boolean(),
});

export async function updateAwardShowCertificate(input: {
  awardId: string;
  showCertificate: boolean;
}): Promise<void> {
  await requireAuth();
  const { awardId, showCertificate } = UpdateAwardShowCertificateSchema.parse(input);

  await db.update(awards).set({ showCertificate }).where(eq(awards.id, awardId));

  revalidatePath("/admin/awards");
  revalidatePath("/about");
}
