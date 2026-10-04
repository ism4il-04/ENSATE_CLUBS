"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { suivreAction } from "@/server/actions/suivi";

/** Suivre une organisation (BF-17). Sans session : renvoie vers la connexion. */
export function SuivreBouton({ orgId, suivi, connecte, retour, nom }: { orgId: string; suivi: boolean; connecte: boolean; retour: string; nom: string }) {
  const [etat, setEtat] = useState(suivi);
  const [optimiste, setOptimiste] = useOptimistic(etat);
  const [erreur, setErreur] = useState<string | null>(null);
  const [, start] = useTransition();
  const cls = "press flex h-12 items-center gap-2 rounded-full px-4.5 text-sm font-extrabold";

  if (!connecte) {
    return (
      <Link href={`/connexion?retour=${encodeURIComponent(retour)}`} className={`${cls} bg-accent text-ink`}>
        <Icon name="heart" size={16} stroke={2.4} /> Suivre
      </Link>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        aria-pressed={optimiste}
        aria-label={optimiste ? `Ne plus suivre ${nom}` : `Suivre ${nom}`}
        onClick={() =>
          start(async () => {
            setOptimiste(!optimiste);
            const r = await suivreAction(orgId, !optimiste);
            setEtat(r.suivi);
            setErreur(r.ok ? null : (r.message ?? null));
          })
        }
        className={`${cls} ${optimiste ? "border border-accent text-accent" : "bg-accent text-ink"}`}
      >
        <Icon name="heart" size={16} stroke={2.4} fill={optimiste ? "currentColor" : "none"} />
        {optimiste ? "Suivi" : "Suivre"}
      </button>
      {erreur && (
        <span role="alert" className="text-xs font-bold text-danger">
          {erreur}
        </span>
      )}
    </div>
  );
}
