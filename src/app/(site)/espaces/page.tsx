import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OrgBadge } from "@/components/site/OrgBadge";
import { entrerEspaceAction } from "@/server/actions/membres";
import { getSessionUser, mesOrganisations, ORG_COOKIE } from "@/server/permissions";

export const metadata: Metadata = { title: "Mes espaces" };

const ACCES = { COMPTE: "Compte du club", PRESIDENT: "Président·e", TRESORIER: "Trésorier·e", MEMBRE: "Membre" } as const;

/** Choix de l'espace club pour une personne membre de plusieurs organisations. */
export default async function Espaces({ searchParams }: PageProps<"/espaces">) {
  const user = await getSessionUser();
  if (!user) redirect("/connexion?retour=/espaces");
  const list = await mesOrganisations(user.id, user.role);
  if (!list.length) redirect("/");
  const sp = await searchParams;
  const retour = typeof sp.retour === "string" ? sp.retour : "/org";
  if (list.length === 1) redirect("/org");
  const active = (await cookies()).get(ORG_COOKIE)?.value;

  return (
    <>
      <section className="animate-rise flex max-w-2xl flex-col gap-3.5">
        <h1 className="font-display text-[clamp(40px,5.5vw,68px)] leading-[0.95] font-extrabold tracking-[-0.045em]">
          Mes <span className="inline-block -rotate-2 rounded-[0.18em] bg-accent px-[0.12em] text-ink">espaces</span>
        </h1>
        <p className="text-[17px] text-muted">Tu fais partie de plusieurs clubs. Choisis l&apos;espace dans lequel tu veux entrer ; tu pourras en changer à tout moment.</p>
      </section>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
        {list.map(({ org, acces }, i) => (
          <form key={org.id} action={entrerEspaceAction.bind(null, org.id, retour)} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
            <button
              type="submit"
              className={`lift press flex w-full items-center gap-4 rounded-3xl border bg-surface p-4 text-left ${org.id === active ? "border-accent/60" : "border-line"}`}
            >
              <OrgBadge nom={org.nom} sigle={org.sigle} couleur={org.couleur} logoUrl={org.logoUrl} size={56} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[17px] font-extrabold">{org.nom}</span>
                <span className="text-[13px] font-bold text-muted">
                  {ACCES[acces]}
                  {org.id === active && <span className="text-accent"> · espace actuel</span>}
                </span>
              </span>
              <span aria-hidden className="text-xl text-accent">
                →
              </span>
            </button>
          </form>
        ))}
      </div>
    </>
  );
}
