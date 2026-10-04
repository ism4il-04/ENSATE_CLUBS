"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/server/permissions";
import { definirSuivi, peutSuivre } from "@/server/services/suivi";

export type SuiviResult = { ok: boolean; suivi: boolean; message?: string };

export async function suivreAction(orgId: string, suivre: boolean): Promise<SuiviResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, suivi: !suivre, message: "Connecte-toi pour suivre un club." };
  if (!peutSuivre(user.role)) return { ok: false, suivi: !suivre, message: "Seuls les comptes participants peuvent suivre un club." };
  try {
    await definirSuivi(user.id, String(orgId), suivre === true);
  } catch (e) {
    console.error(e);
    return { ok: false, suivi: !suivre, message: "Une erreur est survenue. Réessaie." };
  }
  revalidatePath("/clubs", "layout");
  revalidatePath("/moi/profil");
  return { ok: true, suivi: suivre === true };
}
