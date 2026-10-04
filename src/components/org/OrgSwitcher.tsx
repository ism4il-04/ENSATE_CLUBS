"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { choisirOrganisationAction } from "@/server/actions/membres";

/** Membre de plusieurs organisations : choix du club actif (le serveur revérifie l'appartenance). */
export function OrgSwitcher({ orgs, active }: { orgs: { id: string; nom: string }[]; active: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex flex-col gap-1 text-xs font-bold text-muted">
      Changer de club
      <select
        value={active}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await choisirOrganisationAction(e.target.value);
            router.push("/org");
            router.refresh();
          })
        }
        className="h-10 rounded-xl border border-line-strong bg-surface px-2 text-sm font-bold text-paper [color-scheme:dark]"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nom}
          </option>
        ))}
      </select>
    </label>
  );
}
