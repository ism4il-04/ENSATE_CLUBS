import { SpaceShell } from "@/components/space/SpaceShell";
import { OrgSwitcher } from "@/components/org/OrgSwitcher";
import { mesOrganisations, peut, requireOrgPage } from "@/server/permissions";

const ACCES = { COMPTE: "Compte du club", PRESIDENT: "Président·e", TRESORIER: "Trésorier·e", MEMBRE: "Membre" } as const;

export default async function OrgLayout({ children }: LayoutProps<"/org">) {
  const { user, org, acces } = await requireOrgPage("caisse", "/org");
  const autres = (await mesOrganisations(user.id, user.role)).map((x) => ({ id: x.org.id, nom: x.org.nom }));
  return (
    <SpaceShell
      identity={{ initials: org.sigle ?? org.nom.slice(0, 2).toUpperCase(), name: org.nom, sub: ACCES[acces], color: org.couleur }}
      switcher={autres.length > 1 ? <OrgSwitcher orgs={autres} active={org.id} /> : undefined}
      navLabel="Espace organisation"
      links={[
        { href: "/org", label: "Mes événements", icon: "ticket", exact: true },
        ...(peut(acces, "gerer") ? [{ href: "/org/evenements/nouveau", label: "Nouvel événement", icon: "grid" as const }] : []),
        ...(peut(acces, "finance") ? [{ href: "/org/tresorerie", label: "Trésorerie", icon: "wallet" as const }] : []),
        ...(peut(acces, "gerer")
          ? [
              { href: "/org/membres", label: "Membres", icon: "users" as const },
              { href: "/org/profil", label: "Profil du club", icon: "user" as const },
            ]
          : []),
      ]}
    >
      {children}
    </SpaceShell>
  );
}
