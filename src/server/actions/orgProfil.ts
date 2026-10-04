"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/server/db";
import { AccessError, requireOrganisation } from "@/server/permissions";

export type OrgProfilState = { ok: boolean; message: string } | null;

const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const Profil = z.object({
  sigle: opt(6),
  description: opt(2000),
  couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide."),
  emailContact: z.union([z.literal(""), z.string().trim().email("Email de contact invalide.")]).transform((v) => v || null),
  telephoneContact: opt(20),
  instagram: opt(60),
  linkedin: z.union([z.literal(""), z.string().trim().url("Lien LinkedIn invalide.").startsWith("https://", "Le lien LinkedIn doit commencer par https://")]).transform((v) => v || null),
  logoUrl: z.union([z.literal(""), z.string().trim().url().startsWith("https://", "Le logo doit être un lien https://")]).transform((v) => v || null),
});

export async function updateOrgProfil(_prev: OrgProfilState, formData: FormData): Promise<OrgProfilState> {
  try {
    const { org } = await requireOrganisation("gerer");
    const parsed = Profil.safeParse(Object.fromEntries(["sigle", "description", "couleur", "emailContact", "telephoneContact", "instagram", "linkedin", "logoUrl"].map((k) => [k, String(formData.get(k) ?? "")])));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Données invalides." };
    await getDb().update(s.organisation).set(parsed.data).where(eq(s.organisation.id, org.id));
    revalidatePath("/org", "layout");
    revalidatePath(`/clubs/${org.slug}`);
    return { ok: true, message: "Profil enregistré : la page publique est à jour." };
  } catch (e) {
    if (e instanceof AccessError) return { ok: false, message: "Accès refusé." };
    throw e;
  }
}
