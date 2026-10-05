import { api } from "@/server/api/http";
import { requireRole } from "@/server/permissions";
import { listMyInscriptions, splitByPeriod } from "@/server/queries/moi";

// Mes inscriptions. Filtre : periode=a_venir | passees.
export const GET = api(async (req: Request) => {
  const user = await requireRole();
  const periode = new URL(req.url).searchParams.get("periode");
  const all = await listMyInscriptions(user.id);
  const { avenir, passes } = splitByPeriod(all);
  const list = periode === "passees" ? passes : periode === "a_venir" ? avenir : all;
  return list.map(({ ins, evt, debut, fin, tarif }) => ({
    id: ins.id,
    statut: ins.statut,
    source: ins.source,
    paye: !!ins.datePaiement,
    tarif: tarif?.libelle ?? null,
    evenement: { id: evt.id, slug: evt.slug, titre: evt.titre, statut: evt.statut, couleur: evt.couleur },
    debut,
    fin,
  }));
});
