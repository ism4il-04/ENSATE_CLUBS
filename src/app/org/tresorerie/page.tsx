import type { Metadata } from "next";
import { PageTitle } from "@/components/space/SpaceShell";
import { TresorerieScreen } from "@/components/tresorerie/TresorerieScreen";
import { aujourdhui } from "@/lib/dates";
import { requireOrgPage } from "@/server/permissions";
import { billetterie, CATEGORIES, evenementsDeLOrganisation, listTransactions, synthese } from "@/server/services/tresorerie";
import { uploadsEnabled } from "@/server/uploads";

export const metadata: Metadata = { title: "Trésorerie" };

/** BF-44 : trésorerie privée de l'organisation (RG-21 : ni coordinateur, ni admin, ni partenaires). */
export default async function Tresorerie({ searchParams }: PageProps<"/org/tresorerie">) {
  const { org } = await requireOrgPage("finance", "/org/tresorerie");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const filtres = { type: one(sp.type) as "RECETTE" | "DEPENSE" | undefined, evenement: one(sp.evenement), du: one(sp.du), au: one(sp.au) };
  const [resume, transactions, ventes, evenements] = await Promise.all([synthese(org.id), listTransactions(org.id, filtres), billetterie(org.id), evenementsDeLOrganisation(org.id)]);

  return (
    <>
      <PageTitle kicker="Privé · visible uniquement par ton organisation" title="Trésorerie" />
      <TresorerieScreen
        aujourdhui={aujourdhui()}
        uploads={uploadsEnabled()}
        categories={[...CATEGORIES]}
        evenements={evenements}
        filtres={filtres}
        resume={resume}
        billetterie={ventes}
        transactions={transactions.map(({ t, evenement, auteur }) => ({
          id: t.id,
          type: t.type,
          montant: Number(t.montant),
          libelle: t.libelle,
          categorie: t.categorie,
          dateOperation: t.dateOperation,
          idEvenement: t.idEvenement,
          evenement,
          justificatif: t.justificatifId,
          auteur,
        }))}
      />
    </>
  );
}
