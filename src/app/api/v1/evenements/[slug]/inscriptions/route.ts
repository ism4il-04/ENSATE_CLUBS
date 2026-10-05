import { z } from "zod";
import { api, ApiError, corps } from "@/server/api/http";
import { inscriptionEnregistree, notify } from "@/server/email/notifications";
import { requireRole } from "@/server/permissions";
import { getPublicEvent } from "@/server/queries/evenements";
import { inscrire } from "@/server/services/inscriptions";

const Corps = z.object({ telephone: z.string().max(30).optional() });

// Inscription en ligne (RG-11, RG-12, RG-14, RG-28). Corps facultatif : { "telephone": "06…" }.
export const POST = api(async (req: Request, { params }: RouteContext<"/api/v1/evenements/[slug]/inscriptions">) => {
  const user = await requireRole("ETUDIANT", "EXTERNE");
  const e = await getPublicEvent((await params).slug);
  if (!e) throw new ApiError(404, "INTROUVABLE", "Événement introuvable.");
  const { telephone } = req.headers.get("content-length") === "0" ? { telephone: undefined } : await corps(req, Corps);
  const { inscription } = await inscrire({ compteId: user.id, role: user.role, eventId: e.id, source: "EN_LIGNE", telephone: telephone ?? null });
  notify(() => inscriptionEnregistree(inscription.id));
  return {
    idInscription: inscription.id,
    statut: inscription.statut,
    billet: `/api/v1/moi/inscriptions/${inscription.id}`,
    message: inscription.statut === "PRE_INSCRITE" ? "Payez au stand pour confirmer votre place." : inscription.statut === "LISTE_ATTENTE" ? "Vous êtes sur liste d'attente." : "Place confirmée.",
  };
});
