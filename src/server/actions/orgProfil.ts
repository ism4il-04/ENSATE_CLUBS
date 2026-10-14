"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/server/db";
import { AccessError, requireOrganisation } from "@/server/permissions";
import { logoParDefaut } from "@/lib/logos";
import { imageAcceptee } from "@/server/uploads";

export type OrgProfilState = { ok: boolean; message: string } | null;

const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const Profil = z.object({
  sigle: opt(8),
  description: opt(2000),
  couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide."),
  emailContact: z.union([z.literal(""), z.string().trim().email("Email de contact invalide.")]).transform((v) => v || null),
  telephoneContact: opt(20),
  instagram: opt(60),
  tiktok: opt(60),
  linkedin: z.union([z.literal(""), z.string().trim().url("Lien LinkedIn invalide.").startsWith("https://", "Le lien LinkedIn doit commencer par https://")]).transform((v) => v || null),
  // Image envoyée sur Cloudinary ou logo par défaut du club (vérifié ci-dessous).
  logoUrl: z.string().trim().max(500).transform((v) => v || null),
});

export async function updateOrgProfil(_prev: OrgProfilState, formData: FormData): Promise<OrgProfilState> {
  try {
    const { org } = await requireOrganisation("gerer");
    const parsed = Profil.safeParse(Object.fromEntries(["sigle", "description", "couleur", "emailContact", "telephoneContact", "instagram", "tiktok", "linkedin", "logoUrl"].map((k) => [k, String(formData.get(k) ?? "")])));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Données invalides." };
    // Sans logo envoyé, le club garde (ou retrouve) son logo par défaut.
    const defaut = logoParDefaut(org.slug);
    const logo = parsed.data.logoUrl ?? defaut;
    if (logo && logo !== org.logoUrl && logo !== defaut && !imageAcceptee(logo)) return { ok: false, message: "Le logo doit être envoyé depuis la plateforme." };
    parsed.data.logoUrl = logo;
    await getDb().update(s.organisation).set(parsed.data).where(eq(s.organisation.id, org.id));
    revalidatePath("/org", "layout");
    revalidatePath(`/clubs/${org.slug}`);
    return { ok: true, message: "Profil enregistré : la page publique est à jour." };
  } catch (e) {
    if (e instanceof AccessError) return { ok: false, message: "Accès refusé." };
    throw e;
  }
}
