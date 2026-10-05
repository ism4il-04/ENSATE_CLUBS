import { z } from "zod";
import { api, ApiError, corps } from "@/server/api/http";
import { orgSurEvenement } from "@/server/api/serialiser";
import { evenementComplet, notify, paiementEnregistre } from "@/server/email/notifications";
import { marquerPaye, trouverParBillet } from "@/server/services/caisse";

const Corps = z.object({ idEvenement: z.string().uuid(), tokenBillet: z.string().min(20).max(400), idTarif: z.string().uuid("Tarif invalide.") });

// Marque payé à partir du scan d'un billet (BF-39).
export const POST = api(
  async (req: Request) => {
    const b = await corps(req, Corps);
    const { org } = await orgSurEvenement(b.idEvenement, "caisse");
    const inscriptionId = await trouverParBillet(b.idEvenement, b.tokenBillet);
    if (!inscriptionId) throw new ApiError(422, "BILLET_INVALIDE", "Ce billet ne correspond pas à cet événement.");
    const r = await marquerPaye({ eventId: b.idEvenement, inscriptionId, tarifId: b.idTarif, orgId: org.id });
    notify(() => paiementEnregistre(inscriptionId));
    if (r.complet) notify(() => evenementComplet(b.idEvenement));
    return { idInscription: inscriptionId, statut: "CONFIRMEE", tarif: r.tarif, montant: r.montant.toFixed(2) };
  },
  { status: 200 },
);
