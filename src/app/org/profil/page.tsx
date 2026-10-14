import type { Metadata } from "next";
import { OrgProfilForm } from "@/components/org/OrgProfilForm";
import { PageTitle } from "@/components/space/SpaceShell";
import { logoParDefaut } from "@/lib/logos";
import { requireOrgPage } from "@/server/permissions";
import { uploadsEnabled } from "@/server/uploads";

export const metadata: Metadata = { title: "Profil du club" };

export default async function OrgProfil() {
  const { org } = await requireOrgPage("gerer", "/org/profil");
  return (
    <>
      <PageTitle kicker="Page publique" title="Profil du club" />
      <OrgProfilForm org={org} uploads={uploadsEnabled()} logoDefaut={logoParDefaut(org.slug)} />
    </>
  );
}
