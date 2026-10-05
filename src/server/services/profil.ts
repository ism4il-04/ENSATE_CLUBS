import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Role } from "@/auth";
import { getDb, schema as s } from "@/server/db";
import { normalizePhone } from "./inscriptions";

// Profil d'un participant (BF-11, BF-27) : téléphone, niveau (étudiant) ou organisme (externe).
// Le nom et la photo viennent de Google.

export const NIVEAUX = ["CP1", "CP2", "1A", "2A", "3A"] as const;

export const ProfilSchema = z.object({
  telephone: z.string().trim().max(20).optional().default(""),
  niveau: z.string().trim().max(20).optional().default(""),
  organisme: z.string().trim().max(80).optional().default(""),
});

export class ProfilError extends Error {}

export async function mettreAJourProfil(user: { id: string; role: Role }, input: z.input<typeof ProfilSchema>) {
  const d = ProfilSchema.parse(input);
  let telephone: string | null = null;
  if (d.telephone) {
    telephone = normalizePhone(d.telephone);
    if (!telephone) throw new ProfilError("Numéro invalide : exemple 06 12 34 56 78.");
  }
  await getDb()
    .update(s.personne)
    .set(
      user.role === "EXTERNE"
        ? { telephone, organisme: d.organisme || null }
        : { telephone, niveau: (NIVEAUX as readonly string[]).includes(d.niveau) ? d.niveau : null },
    )
    .where(eq(s.personne.idCompte, user.id));
}
