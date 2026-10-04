"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/server/db";
import { getSessionUser } from "@/server/permissions";
import { normalizePhone } from "@/server/services/inscriptions";

export type ProfilState = { ok: boolean; message: string } | null;

const Profil = z.object({
  telephone: z.string().trim().max(20),
  niveau: z.string().trim().max(20),
  organisme: z.string().trim().max(80),
});

const NIVEAUX = new Set(["CP1", "CP2", "1A", "2A", "3A"]);

export async function updateProfil(_prev: ProfilState, formData: FormData): Promise<ProfilState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Session expirée : reconnecte-toi." };
  const parsed = Profil.safeParse({ telephone: formData.get("telephone") ?? "", niveau: formData.get("niveau") ?? "", organisme: formData.get("organisme") ?? "" });
  if (!parsed.success) return { ok: false, message: "Données invalides." };

  let telephone: string | null = null;
  if (parsed.data.telephone) {
    telephone = normalizePhone(parsed.data.telephone);
    if (!telephone) return { ok: false, message: "Numéro invalide : exemple 06 12 34 56 78." };
  }
  await getDb()
    .update(s.personne)
    .set(
      user.role === "EXTERNE"
        ? { telephone, organisme: parsed.data.organisme || null }
        : { telephone, niveau: NIVEAUX.has(parsed.data.niveau) ? parsed.data.niveau : null },
    )
    .where(eq(s.personne.idCompte, user.id));
  revalidatePath("/moi/profil");
  return { ok: true, message: "Profil enregistré." };
}
