import { api, ApiError, montant, uuid } from "@/server/api/http";
import { notify, promotionListeAttente } from "@/server/email/notifications";
import { requireRole } from "@/server/permissions";
import { listMyInscriptions } from "@/server/queries/moi";
import { annulerParEtudiant } from "@/server/services/inscriptions";

// Mon billet : jeton (contenu du QR), événement, créneaux, présences.
export const GET = api(async (_req: Request, { params }: RouteContext<"/api/v1/moi/inscriptions/[id]">) => {
  const user = await requireRole();
  const id = uuid((await params).id);
  const item = (await listMyInscriptions(user.id)).find((x) => x.ins.id === id);
  if (!item) throw new ApiError(404, "INTROUVABLE", "Billet introuvable.");
  const { ins, evt, creneaux, presences, tarif } = item;
  return {
    id: ins.id,
    statut: ins.statut,
    valide: ins.statut === "CONFIRMEE" && evt.statut !== "ANNULE",
    jeton: ins.tokenBillet,
    paiement: ins.datePaiement ? { tarif: tarif?.libelle ?? null, montant: montant(ins.montantPaye), date: ins.datePaiement } : null,
    evenement: { id: evt.id, slug: evt.slug, titre: evt.titre, statut: evt.statut, couleur: evt.couleur },
    creneaux: creneaux.map((c) => ({ id: c.id, debut: c.debut, fin: c.fin, present: presences.some((p) => p.idCreneau === c.id) })),
  };
});

// Annule mon inscription si elle n'est pas payée (RG-17) ; promotion de la liste d'attente.
export const DELETE = api(
  async (_req: Request, { params }: RouteContext<"/api/v1/moi/inscriptions/[id]">) => {
    const user = await requireRole();
    const { promu } = await annulerParEtudiant(user.id, uuid((await params).id));
    if (promu) notify(() => promotionListeAttente(promu));
    return { ok: true };
  },
  { status: 200 },
);
