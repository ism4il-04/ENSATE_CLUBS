"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getSessionUser } from "@/server/permissions";
import { mettreAJourProfil, ProfilError } from "@/server/services/profil";

export type ProfilState = { ok: boolean; message: string } | null;

export async function updateProfil(_prev: ProfilState, formData: FormData): Promise<ProfilState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Session expirée : reconnecte-toi." };
  try {
    await mettreAJourProfil(user, {
      telephone: String(formData.get("telephone") ?? ""),
      niveau: String(formData.get("niveau") ?? ""),
      organisme: String(formData.get("organisme") ?? ""),
    });
  } catch (e) {
    if (e instanceof ProfilError) return { ok: false, message: e.message };
    if (e instanceof ZodError) return { ok: false, message: "Données invalides." };
    throw e;
  }
  revalidatePath("/moi/profil");
  return { ok: true, message: "Profil enregistré." };
}
