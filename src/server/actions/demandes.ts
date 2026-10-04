"use server";

import { revalidatePath } from "next/cache";
import { AccessError, requireOrganisation, requireRole } from "@/server/permissions";
import { DemandeError, saveDemande, type DemandeInput } from "@/server/services/demandes";

export type DemandeResult = { ok: true; id: string; submitted: boolean } | { ok: false; erreurs: string[] };

async function run(input: DemandeInput, submit: boolean, mode: "org" | "coord"): Promise<DemandeResult> {
  try {
    let ctx;
    if (mode === "coord") {
      const user = await requireRole("COORDINATEUR", "ADMIN");
      ctx = { compteId: user.id, coordinateur: true, submit };
    } else {
      const { user, org } = await requireOrganisation();
      ctx = { compteId: user.id, orgId: org.id, submit };
    }
    const { id } = await saveDemande(input, ctx);
    revalidatePath("/org");
    revalidatePath("/coord");
    return { ok: true, id, submitted: submit };
  } catch (e) {
    if (e instanceof DemandeError) return { ok: false, erreurs: e.erreurs };
    if (e instanceof AccessError) return { ok: false, erreurs: ["Accès refusé."] };
    console.error(e);
    return { ok: false, erreurs: ["Une erreur est survenue. Réessaie."] };
  }
}

export async function enregistrerDemande(input: DemandeInput, submit: boolean) {
  return run(input, submit, "org");
}

export async function creerPourUnClub(input: DemandeInput) {
  return run(input, true, "coord");
}
