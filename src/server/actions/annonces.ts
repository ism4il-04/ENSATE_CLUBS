"use server";

import { revalidatePath } from "next/cache";
import { annonceEnvoyee, notify } from "@/server/email/notifications";
import { AccessError, requireOrganisation, roleOnEvent } from "@/server/permissions";
import { AnnonceError, creerAnnonce } from "@/server/services/annonces";

export type AnnonceResult = { ok: boolean; message: string; at: number } | null;

/** Organisation principale ou partenaire de l'événement (BF-45). */
export async function envoyerAnnonceAction(eventId: string, _prev: AnnonceResult, fd: FormData): Promise<AnnonceResult> {
  const at = Date.now();
  try {
    const { user, org } = await requireOrganisation();
    if (!(await roleOnEvent(org.id, eventId))) throw new AccessError("ACCES_REFUSE");
    const r = await creerAnnonce({
      eventId,
      orgId: org.id,
      auteurId: user.id,
      input: { titre: String(fd.get("titre") ?? ""), contenu: String(fd.get("contenu") ?? ""), cible: String(fd.get("cible") ?? "") as "TOUS" },
    });
    notify(() => annonceEnvoyee(r.id, r.destinataires));
    revalidatePath(`/org/evenements/${eventId}/annonces`);
    revalidatePath("/moi/billets", "layout");
    return { ok: true, message: `Annonce envoyée à ${r.nombre} personne${r.nombre > 1 ? "s" : ""}.`, at };
  } catch (e) {
    if (e instanceof AnnonceError) return { ok: false, message: e.message, at };
    if (e instanceof AccessError) return { ok: false, message: "Accès refusé.", at };
    console.error(e);
    return { ok: false, message: "Une erreur est survenue. Réessaie.", at };
  }
}
