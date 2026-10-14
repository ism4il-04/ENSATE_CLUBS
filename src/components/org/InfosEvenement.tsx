"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CATEGORIES } from "@/lib/format";
import { demanderChangementAction, modifierInfosAction, reprendreDemandeAction, type EvenementResult } from "@/server/actions/evenement";

const field = "h-12 rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 font-semibold text-paper outline-none focus:border-accent";

function Statut({ r }: { r: EvenementResult | null }) {
  if (!r) return null;
  return (
    <span role={r.ok ? "status" : "alert"} className={`text-sm font-bold ${r.ok ? "text-accent" : "text-danger"}`}>
      {r.message}
    </span>
  );
}

/** Titre, catégorie et description courte d'un événement validé ou publié. */
export function InfosEvenement({ eventId, initial }: { eventId: string; initial: { titre: string; categorie: string; descriptionCourte: string } }) {
  const router = useRouter();
  const [titre, setTitre] = useState(initial.titre);
  const [categorie, setCategorie] = useState(initial.categorie);
  const [desc, setDesc] = useState(initial.descriptionCourte);
  const [res, setRes] = useState<EvenementResult | null>(null);
  const [pending, start] = useTransition();
  const modifie = titre !== initial.titre || categorie !== initial.categorie || desc !== initial.descriptionCourte;

  return (
    <section className="flex flex-col gap-3.5 rounded-3xl border border-line bg-surface p-5">
      <h2 className="text-[17px] font-extrabold">Informations générales</h2>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
          Titre
          <input value={titre} maxLength={120} onChange={(e) => setTitre(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
          Catégorie
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={`${field} [color-scheme:dark]`}>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
        Description courte (affichée sur les cartes)
        <textarea
          rows={2}
          maxLength={600}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="resize-y rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 py-3 leading-relaxed font-medium text-paper outline-none focus:border-accent"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!modifie || pending}
          onClick={() =>
            start(async () => {
              const r = await modifierInfosAction(eventId, { titre, categorie, descriptionCourte: desc });
              setRes(r);
              if (r.ok) router.refresh();
            })
          }
          className="press h-11 rounded-full bg-accent px-5 text-sm font-extrabold text-ink disabled:opacity-40"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <Statut r={res} />
      </div>
      <p className="text-[13px] text-faint">L&apos;adresse de la page de l&apos;événement ne change pas : les liens déjà partagés restent valides.</p>
    </section>
  );
}

/** Dates et lieux : verrouillés après validation ; le club envoie une demande au coordinateur. */
export function ChangementCreneaux({ eventId }: { eventId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState("");
  const [res, setRes] = useState<EvenementResult | null>(null);
  const [pending, start] = useTransition();

  if (res?.ok) {
    return (
      <p role="status" className="rounded-2xl border border-accent/40 bg-accent/8 px-4 py-3 text-sm font-bold text-accent">
        {res.message}
      </p>
    );
  }
  return ouvert ? (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4">
      <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
        Changement souhaité (date, horaire ou lieu)
        <textarea
          rows={3}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ex. : décaler le jour 2 au jeudi 22 de 14 h à 17 h, en salle 201."
          className="resize-y rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 py-3 leading-relaxed font-medium text-paper outline-none focus:border-accent"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || message.trim().length < 10}
          onClick={() => start(async () => setRes(await demanderChangementAction(eventId, message)))}
          className="press h-11 rounded-full bg-accent px-5 text-sm font-extrabold text-ink disabled:opacity-40"
        >
          {pending ? "Envoi…" : "Envoyer au coordinateur"}
        </button>
        <button type="button" onClick={() => setOuvert(false)} className="press h-11 rounded-full px-4 text-sm font-bold text-muted">
          Annuler
        </button>
        <Statut r={res} />
      </div>
    </div>
  ) : (
    <button type="button" onClick={() => setOuvert(true)} className="press h-11 self-start rounded-full border border-line-strong px-4 text-sm font-extrabold">
      Demander un changement de date ou de lieu
    </button>
  );
}

/** Reprendre une demande envoyée au coordinateur pour la modifier. */
export function ReprendreDemande({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirmer) {
    return (
      <button type="button" onClick={() => setConfirmer(true)} className="press flex h-11 items-center rounded-full border border-line-strong px-4 text-sm font-extrabold">
        Modifier la demande
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
      Elle repassera en brouillon, à renvoyer ensuite.
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await reprendreDemandeAction(eventId);
            if (r.ok) router.push(`/org/evenements/${eventId}/demande`);
            else setErreur(r.message);
          })
        }
        className="press h-10 rounded-full bg-accent px-4 text-[13px] font-extrabold text-ink"
      >
        {pending ? "…" : "Confirmer"}
      </button>
      <button type="button" onClick={() => setConfirmer(false)} className="press h-10 rounded-full px-3 font-bold">
        Annuler
      </button>
      {erreur && <span className="font-bold text-danger">{erreur}</span>}
    </span>
  );
}

