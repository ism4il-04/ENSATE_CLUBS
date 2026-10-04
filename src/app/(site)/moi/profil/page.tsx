import type { Metadata } from "next";
import { auth } from "@/auth";
import { ProfilForm } from "@/components/moi/ProfilForm";
import { SignOutButton } from "@/components/moi/SignOutButton";
import { requireUser } from "@/server/permissions";
import { getPersonne } from "@/server/queries/moi";

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
  const [personne, session] = await Promise.all([getPersonne(user.id), auth()]);
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

      {personne && <ProfilForm telephone={personne.telephone ?? ""} niveau={personne.niveau ?? ""} />}

      <SignOutButton />
    </section>
  );
}
