import { z } from "zod";
import { api, corps } from "@/server/api/http";
import { orgSurInscription } from "@/server/api/serialiser";
import { evenementComplet, notify, paiementEnregistre } from "@/server/email/notifications";
import { annulerPaiement, marquerPaye } from "@/server/services/caisse";

const Corps = z.object({ idTarif: z.string().uuid("Tarif invalide.") });

// Marque payé avec le tarif choisi par le club (RG-13, RG-18, RG-32).
export const POST = api(
  async (req: Request, { params }: RouteContext<"/api/v1/org/inscriptions/[id]/paiement">) => {
    const { id } = await params;
    const { org, eventId } = await orgSurInscription(id, "caisse");
    const { idTarif } = await corps(req, Corps);
    const r = await marquerPaye({ eventId, inscriptionId: id, tarifId: idTarif, orgId: org.id });
    notify(() => paiementEnregistre(id));
    if (r.complet) notify(() => evenementComplet(eventId));
    return { statut: "CONFIRMEE", tarif: r.tarif, montant: r.montant.toFixed(2), complet: r.complet };
  },
  { status: 200 },
);

// Annule un paiement saisi par erreur (seulement l'organisation qui a encaissé).
export const DELETE = api(
  async (_req: Request, { params }: RouteContext<"/api/v1/org/inscriptions/[id]/paiement">) => {
    const { id } = await params;
    const { org, eventId } = await orgSurInscription(id, "caisse");
    await annulerPaiement({ eventId, inscriptionId: id, orgId: org.id });
    return { statut: "PRE_INSCRITE" };
  },
  { status: 200 },
);
