"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { inscrireEnLigne, type InscriptionState } from "@/server/actions/inscriptions";

type Props = {
  event: {
    id: string;
    slug: string;
    gratuit: boolean;
    mode: "AUCUNE" | "STAND" | "EN_LIGNE";
    ouvertes: boolean;
    telephoneRequis: boolean;
    ouvertExternes: boolean;
    complet: boolean;
    listeAttente: boolean;
    prix: string;
  };
  user: { role: string; hasPhone: boolean } | null;
  existing: { id: string; statut: string; paye: boolean } | null;
};

const STATUS: Record<string, { label: string; text: string; tone: string }> = {
  CONFIRMEE: { label: "Confirmé", text: "Ta place est réservée. Ton billet est prêt.", tone: "bg-accent text-ink" },
  PRE_INSCRITE: {
    label: "Pré-inscrit — à payer au stand",
    text: "Donne ton nom au stand : le club applique ton tarif et encaisse. Une pré-inscription ne bloque pas de place.",
    tone: "bg-amber text-ink",
  },
  LISTE_ATTENTE: { label: "Liste d'attente", text: "Tu seras prévenu si une place se libère.", tone: "bg-sky text-ink" },
};

export function InscriptionPanel({ event, user, existing }: Props) {
  const [state, action, pending] = useActionState<InscriptionState, FormData>(inscrireEnLigne, null);
  const [askPhone, setAskPhone] = useState(false);

  const current = state?.ok ? { id: state.inscriptionId, statut: state.statut, paye: false } : existing;

  if (current) {
    const st = STATUS[current.statut] ?? STATUS.CONFIRMEE;
    return (
      <div className="animate-rise flex flex-col gap-3.5 rounded-[26px] border border-line-strong bg-surface-2 p-4.5">
        <div className="flex items-start gap-3">
          <span className={`grid size-10.5 flex-none place-items-center rounded-xl ${st.tone}`}>
            <Icon name={current.statut === "CONFIRMEE" ? "check" : "clock"} size={20} stroke={2.6} />
          </span>
          <div className="flex flex-col gap-1">
            <span className="font-extrabold">{st.label}</span>
            <span className="text-[13px] leading-snug text-muted">{st.text}</span>
          </div>
        </div>
        <Link href={`/moi/billets/${current.id}`} className="press flex h-12 items-center justify-center rounded-full bg-accent font-extrabold text-ink">
          Voir mon billet
        </Link>
      </div>
    );
  }

  const blocked =
    event.mode === "STAND"
      ? "Inscription au stand du club : scanne le QR affiché au stand."
      : event.mode === "AUCUNE"
        ? "Entrée libre, sans inscription."
        : !event.ouvertes
          ? "Les inscriptions en ligne sont fermées."
          : user?.role === "EXTERNE" && !event.ouvertExternes
            ? "Réservé aux étudiants de l'ENSA."
            : user && user.role !== "ETUDIANT" && user.role !== "EXTERNE"
              ? "Ce compte ne s'inscrit pas aux événements."
              : event.complet && !(event.gratuit && event.listeAttente)
                ? "Complet."
                : null;

  const needPhone = event.telephoneRequis && user && !user.hasPhone;
  const label = event.complet && event.gratuit ? "Rejoindre la liste d'attente" : "S'inscrire";

  return (
    <div className="flex flex-col gap-3.5 rounded-[26px] border border-line bg-surface p-4.5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-display text-[26px] leading-none font-extrabold">{event.prix}</span>
          <span className="mt-1 text-[13px] text-muted">{event.gratuit ? "sans paiement" : "tarif appliqué par le club au stand"}</span>
        </div>
        {event.telephoneRequis && (
          <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">
            <Icon name="phone" size={13} /> Téléphone requis
          </span>
        )}
      </div>

      {blocked ? (
        <div className="rounded-2xl border-[1.5px] border-dashed border-line-strong px-4 py-3.5 text-center text-sm font-bold text-soft">{blocked}</div>
      ) : !user ? (
        <Link
          href={`/connexion?retour=${encodeURIComponent(`/evenements/${event.slug}`)}`}
          className="press flex h-14 items-center justify-center gap-2.5 rounded-full bg-accent text-[17px] font-extrabold text-ink"
        >
          Se connecter pour s&apos;inscrire <Icon name="arrowRight" stroke={2.6} />
        </Link>
      ) : (
        <form
          action={action}
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            if (needPhone && !askPhone) {
              e.preventDefault();
              setAskPhone(true);
            }
          }}
        >
          <input type="hidden" name="eventId" value={event.id} />
          <input type="hidden" name="slug" value={event.slug} />
          {needPhone && askPhone && (
            <div className="animate-rise flex flex-col gap-2">
              <label htmlFor="telephone" className="text-sm font-bold">
                Téléphone <span className="font-medium text-muted">(visible uniquement par les organisateurs)</span>
              </label>
              <input
                id="telephone"
                name="telephone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="06 12 34 56 78"
                className="h-13 rounded-2xl border-[1.5px] border-line-strong bg-ink px-4 text-lg font-semibold tracking-wide outline-none focus:border-accent"
              />
            </div>
          )}
          {state && !state.ok && (
            <span role="alert" className="text-sm font-bold text-danger">
              {state.message}
            </span>
          )}
          <button type="submit" disabled={pending} className="press flex h-14 items-center justify-center gap-2.5 rounded-full bg-accent text-[17px] font-extrabold text-ink">
            {pending ? "Inscription…" : needPhone && askPhone ? "Confirmer mon inscription" : label}
            {!pending && <Icon name="arrowRight" stroke={2.6} />}
          </button>
        </form>
      )}
    </div>
  );
}
