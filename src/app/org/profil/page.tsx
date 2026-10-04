import type { Metadata } from "next";
import { OrgProfilForm } from "@/components/org/OrgProfilForm";
import { PageTitle } from "@/components/space/SpaceShell";
import { requireOrganisation } from "@/server/permissions";

export const metadata: Metadata = { title: "Profil du club" };

export default async function OrgProfil() {
  const { org } = await requireOrganisation();
  return (
    <>
      <PageTitle kicker="Page publique" title="Profil du club" />
      <OrgProfilForm org={org} />
    </>
  );
}
