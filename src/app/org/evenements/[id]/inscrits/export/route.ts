import { AccessError, requireOrganisation, roleOnEvent } from "@/server/permissions";
import { listInscrits } from "@/server/services/caisse";

const STATUT: Record<string, string> = { PRE_INSCRITE: "Pré-inscrit", CONFIRMEE: "Confirmé", LISTE_ATTENTE: "Liste d'attente", ANNULEE: "Annulé" };
const SOURCE: Record<string, string> = { EN_LIGNE: "En ligne", STAND: "Stand", MEMBRE: "Membre" };

// Neutralise les formules dans Excel (=, +, -, @, tabulation, retour chariot) et échappe les guillemets.
const cell = (v: unknown) => {
  let t = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return `"${t.replace(/"/g, '""')}"`;
};

export async function GET(_req: Request, { params }: RouteContext<"/org/evenements/[id]/inscrits/export">) {
  const { id } = await params;
  try {
    const { org } = await requireOrganisation();
    if (!(await roleOnEvent(org.id, id))) throw new AccessError("ACCES_REFUSE");
    const { evt, list, creneaux } = await listInscrits(id, org.id);
    const header = ["Nom", "Email", "Téléphone", "Source", "Statut", "Tarif", "Montant (DH)", "Encaissé par", ...creneaux.map((_, i) => `Jour ${i + 1}`)];
    const lines = list.map((r) =>
      [
        r.nom,
        r.email,
        r.telephone ?? "",
        SOURCE[r.source],
        STATUT[r.statut],
        r.tarif ?? "",
        r.montant ?? "",
        r.encaissePar ?? "",
        ...r.presences.map((p) => (p ? "Présent" : "")),
      ]
        .map(cell)
        .join(";"),
    );
    const csv = "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${evt.slug}-inscrits.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AccessError) return new Response("Accès refusé", { status: e.code === "NON_AUTHENTIFIE" ? 401 : 403 });
    throw e;
  }
}
