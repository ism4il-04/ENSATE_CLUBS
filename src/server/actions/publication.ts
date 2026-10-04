"use server";

import { revalidatePath } from "next/cache";
import { notify, publieParCoordinateur } from "@/server/email/notifications";
import { AccessError, getSessionUser, requireOrganisation, roleOnEvent } from "@/server/permissions";
import { PublicationError, savePublication, type PublicationInput } from "@/server/services/publication";

export type PublicationResult = { ok: true; published: boolean; slug: string } | { ok: false; erreurs: string[] };

/** Organisation principale ou coordinateur (RG-04, RG-27). */
async function assertCanEdit(eventId: string) {
  const user = await getSessionUser();
  if (!user) throw new AccessError("NON_AUTHENTIFIE");
  if (user.role === "COORDINATEUR" || user.role === "ADMIN") return { coordinateur: true };
  const { org } = await requireOrganisation();
  if ((await roleOnEvent(org.id, eventId)) !== "PRINCIPAL") throw new AccessError("ACCES_REFUSE");
  return { coordinateur: false };
}

export async function enregistrerPublication(eventId: string, input: PublicationInput, publish: boolean): Promise<PublicationResult> {
  try {
    const { coordinateur } = await assertCanEdit(eventId);
    const r = await savePublication(eventId, input, { publish });
    if (coordinateur && r.nouvellementPublie) notify(() => publieParCoordinateur(eventId));
    revalidatePath("/org");
    revalidatePath(`/org/evenements/${eventId}/publication`);
    revalidatePath(`/coord/evenements/${eventId}`);
    revalidatePath(`/evenements/${r.slug}`);
    revalidatePath("/");
    return { ok: true, published: r.published, slug: r.slug };
  } catch (e) {
    if (e instanceof PublicationError) return { ok: false, erreurs: e.erreurs };
    if (e instanceof AccessError) return { ok: false, erreurs: ["Seule l'organisation principale peut modifier la publication."] };
    console.error(e);
    return { ok: false, erreurs: ["Une erreur est survenue. Réessaie."] };
  }
}
