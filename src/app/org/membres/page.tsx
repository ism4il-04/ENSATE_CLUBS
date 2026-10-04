import type { Metadata } from "next";
import { MembresScreen } from "@/components/org/MembresScreen";
import { PageTitle } from "@/components/space/SpaceShell";
import { requireOrgPage } from "@/server/permissions";
import { listMembres } from "@/server/services/membres";

export const metadata: Metadata = { title: "Membres" };

/** BF-43 : l'équipe du club (compte du club et présidents uniquement). */
export default async function Membres() {
  const { user, org } = await requireOrgPage("gerer", "/org/membres");
  const membres = await listMembres(org.id);
  return (
    <>
      <PageTitle kicker={`${membres.length} membre${membres.length > 1 ? "s" : ""} actif${membres.length > 1 ? "s" : ""}`} title="Équipe du club" />
      <MembresScreen moi={user.id} membres={membres.map((m) => ({ id: m.id, role: m.role, annee: m.annee, idCompte: m.idCompte, email: m.email, nom: [m.prenom, m.nom].filter(Boolean).join(" ") || m.email }))} />
    </>
  );
}
