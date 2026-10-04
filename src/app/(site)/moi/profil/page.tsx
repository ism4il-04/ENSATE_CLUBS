import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { ProfilForm } from "@/components/moi/ProfilForm";
import { SignOutButton } from "@/components/moi/SignOutButton";
import { requireUser } from "@/server/permissions";
import { getPersonne } from "@/server/queries/moi";
import { listSuivis, peutSuivre } from "@/server/services/suivi";
import { mesOrganisations } from "@/server/permissions";

export const metadata: Metadata = { title: "Mon profil" };

const ROLE: Record<string, string> = {
  ETUDIANT: "Étudiant·e ENSA",
  EXTERNE: "Externe : événements ouverts à tous",
  ORGANISATION: "Compte organisation",
  COORDINATEUR: "Coordinateur des clubs",
  ADMIN: "Administrateur",
};

export default async function Profil() {
  const user = await requireUser("/moi/profil");
  const [personne, session, suivis, equipes] = await Promise.all([getPersonne(user.id), auth(), peutSuivre(user.role) ? listSuivis(user.id) : [], mesOrganisations(user.id, user.role)]);
  const nom = [personne?.prenom, personne?.nom].filter(Boolean).join(" ") || session?.user?.name || user.email || "";
  const photo = personne?.photoUrl ?? session?.user?.image;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5.5">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative size-28">
          <span aria-hidden className="animate-spin-slow absolute inset-0 rounded-full border-2 border-dashed border-accent" />
          <span className="absolute inset-2 grid place-items-center overflow-hidden rounded-full bg-surface-2 font-display text-3xl font-extrabold">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              nom.slice(0, 2).toUpperCase()
            )}
          </span>
        </div>
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{nom}</h1>
          <div className="mt-1 text-sm text-muted">{user.email}</div>
        </div>
        <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-muted">{ROLE[user.role]}</span>
      </div>

      {personne && <ProfilForm telephone={personne.telephone ?? ""} niveau={personne.niveau ?? ""} organisme={personne.organisme ?? ""} externe={user.role === "EXTERNE"} />}

      {user.role !== "ORGANISATION" && equipes.length > 0 && (
        <Link href="/org" className="press flex items-center justify-between gap-3 rounded-3xl border border-accent/50 bg-accent/8 p-4">
          <span className="flex flex-col">
            <span className="font-extrabold">Espace club</span>
            <span className="text-[13px] text-muted">{equipes.map((e) => e.org.nom).join(" · ")}</span>
          </span>
          <span aria-hidden className="text-accent">→</span>
        </Link>
      )}

      {peutSuivre(user.role) && (
        <div className="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface p-4">
          <span className="font-extrabold">Clubs suivis</span>
          {suivis.length ? (
            <div className="flex flex-wrap gap-2">
              {suivis.map((o) => (
                <Link key={o.id} href={`/clubs/${o.slug}`} className="press flex h-10 items-center gap-2 rounded-full border border-line-strong py-1 pr-3.5 pl-1 text-sm font-bold">
                  <span className="grid size-8 place-items-center rounded-full text-[11px] font-extrabold text-ink" style={{ background: o.couleur }}>
                    {(o.sigle ?? o.nom.slice(0, 2)).toUpperCase().slice(0, 3)}
                  </span>
                  {o.nom}
                </Link>
              ))}
            </div>
          ) : (
            <span className="text-[13px] text-muted">Aucun pour l&apos;instant. Suis un club depuis sa page pour recevoir un email à chaque nouvel événement.</span>
          )}
        </div>
      )}

      <SignOutButton />
    </section>
  );
}
