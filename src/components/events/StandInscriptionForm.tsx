"use client";

import Link from "next/link";
import { useActionState } from "react";
import { inscrireAuStand } from "@/server/actions/stand";
import type { InscriptionState } from "@/server/actions/inscriptions";

export function StandInscriptionForm({ sessionId, needPhone, nom, gratuit }: { sessionId: string; needPhone: boolean; nom: string; gratuit: boolean }) {
  const [state, action, pending] = useActionState<InscriptionState, FormData>(inscrireAuStand, null);

  if (state?.ok) return <StandResult statut={state.statut} inscriptionId={state.inscriptionId} nom={nom} gratuit={gratuit} />;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      {needPhone && (
        <label className="flex flex-col gap-2 font-bold">
          Téléphone <span className="text-sm font-medium text-muted">Le club le demande pour cet événement ; il reste visible uniquement par les organisateurs.</span>
          <input
            name="telephone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="06 12 34 56 78"
            className="h-14 rounded-2xl border-[1.5px] border-line-strong bg-surface px-4 text-lg font-bold tracking-wide outline-none focus:border-accent"
          />
        </label>
      )}
      {state && !state.ok && (
        <span role="alert" className="text-sm font-bold text-danger">
          {state.message}
        </span>
      )}
      <button type="submit" disabled={pending} className="press h-14.5 rounded-full bg-accent text-[17px] font-extrabold text-ink">
        {pending ? "Inscription…" : gratuit ? "M'inscrire" : "Me pré-inscrire"}
      </button>
    </form>
  );
}

export function StandResult({ statut, inscriptionId, nom, gratuit }: { statut: string; inscriptionId: string; nom: string; gratuit: boolean }) {
  const confirmed = statut === "CONFIRMEE";
  return (
    <div className="animate-rise flex flex-col items-center gap-5 text-center">
      <span className={`rounded-full px-3.5 py-1.5 text-[13px] font-extrabold tracking-wider uppercase ${confirmed ? "bg-accent/15 text-accent" : "bg-amber/15 text-amber"}`}>
        {confirmed ? "Confirmé" : statut === "LISTE_ATTENTE" ? "Liste d'attente" : "Pré-inscrit"}
      </span>
      <span className={`grid size-32 place-items-center rounded-full font-display text-5xl font-extrabold tracking-tight text-ink ${confirmed ? "bg-accent" : "animate-pulse-ring bg-amber"}`}>
        {nom
          .split(/\s+/)
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </span>
      <span className="font-display text-[44px] leading-[0.95] font-extrabold tracking-[-0.045em]">{nom}</span>
      {!confirmed && !gratuit && (
        <p className="text-soft">Montre cet écran au membre du club : il te retrouve par ton nom, applique ton tarif et confirme ta place dès le paiement.</p>
      )}
      <Link href={`/moi/billets/${inscriptionId}`} className="press flex h-13 items-center rounded-full bg-paper px-6 font-extrabold text-ink">
        Voir mon billet
      </Link>
    </div>
  );
}
