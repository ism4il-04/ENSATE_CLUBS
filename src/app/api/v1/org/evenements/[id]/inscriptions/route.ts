import { api } from "@/server/api/http";
import { orgSurEvenement } from "@/server/api/serialiser";
import { listInscrits } from "@/server/services/caisse";

// Inscrits de l'événement (pré-inscrits en premier). Filtres : statut, source, q (nom ou email).
// Téléphone seulement si l'événement l'exige (RG-30) ; tarif et montant seulement pour les paiements de l'appelant (RG-21).
export const GET = api(async (req: Request, { params }: RouteContext<"/api/v1/org/evenements/[id]/inscriptions">) => {
  const { id } = await params;
  const { org } = await orgSurEvenement(id, "caisse");
  const q = new URL(req.url).searchParams;
  const statut = q.get("statut"), source = q.get("source"), texte = (q.get("q") ?? "").toLowerCase();
  const { list, tarifs, creneaux, stats } = await listInscrits(id, org.id);
  const ordre: Record<string, number> = { PRE_INSCRITE: 0, LISTE_ATTENTE: 1, CONFIRMEE: 2, ANNULEE: 3 };
  return {
    stats,
    tarifs: tarifs.map((t) => ({ id: t.id, libelle: t.libelle, prix: t.prix.toFixed(2), affiche: t.affiche })),
    creneaux: creneaux.map((c) => ({ id: c.id, debut: c.debut, fin: c.fin })),
    inscrits: list
      .filter((r) => (!statut || r.statut === statut) && (!source || r.source === source) && (!texte || `${r.nom} ${r.email}`.toLowerCase().includes(texte)))
      .sort((a, b) => ordre[a.statut] - ordre[b.statut])
      .map((r) => ({
        id: r.id,
        nom: r.nom,
        email: r.email,
        externe: r.externe,
        organisme: r.organisme,
        telephone: r.telephone,
        source: r.source,
        statut: r.statut,
        paye: r.paye,
        encaissePar: r.encaissePar,
        tarif: r.tarif,
        montant: r.montant === null ? null : r.montant.toFixed(2),
        presences: r.presences,
      })),
  };
});
