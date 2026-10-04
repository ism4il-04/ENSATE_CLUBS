import { AccessError, requireFinance } from "@/server/permissions";
import { listTransactions } from "@/server/services/tresorerie";

// Neutralise les formules dans Excel (=, +, -, @, tabulation, retour chariot) et échappe les guillemets.
const cell = (v: unknown) => {
  let t = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return `"${t.replace(/"/g, '""')}"`;
};

export async function GET() {
  try {
    const { org } = await requireFinance();
    const rows = await listTransactions(org.id);
    const header = ["Date", "Libellé", "Catégorie", "Événement", "Recette (DH)", "Dépense (DH)", "Justificatif"];
    const num = (v: string) => Number(v).toFixed(2).replace(".", ","); // positif : jamais pris pour une formule
    const lines = rows.map(({ t, evenement }) =>
      [t.dateOperation, t.libelle, t.categorie, evenement ?? "", t.type === "RECETTE" ? num(t.montant) : "", t.type === "DEPENSE" ? num(t.montant) : "", t.justificatifId ? "oui" : ""]
        .map(cell)
        .join(";"),
    );
    const csv = "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tresorerie-${org.slug}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AccessError) return new Response("Accès refusé", { status: e.code === "NON_AUTHENTIFIE" ? 401 : 403 });
    throw e;
  }
}
