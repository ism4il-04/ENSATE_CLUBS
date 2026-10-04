"use client";

import { useActionState, useState } from "react";
import { envoyerAnnonceAction, type AnnonceResult } from "@/server/actions/annonces";

const field = "rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 font-semibold text-paper outline-none focus:border-accent";

/** BF-45 : rédaction d'une annonce aux inscrits, avec le nombre de destinataires par cible. */
export function AnnonceForm({ eventId, compte, restantes }: { eventId: string; compte: { CONFIRMES: number; INSCRITS: number; TOUS: number }; restantes: number }) {
  const [state, action, pending] = useActionState<AnnonceResult, FormData>(envoyerAnnonceAction.bind(null, eventId), null);
  const [cible, setCible] = useState<"CONFIRMES" | "INSCRITS" | "TOUS">("INSCRITS");
  const [contenu, setContenu] = useState("");
  // Après un envoi réussi, on vide le message (le titre, non contrôlé, est remis à zéro par le formulaire).
  const [envoiTraite, setEnvoiTraite] = useState<number | null>(null);
  if (state?.ok && state.at !== envoiTraite) {
    setEnvoiTraite(state.at);
    setContenu("");
  }
  const n = compte[cible];
  const options = [
    ["CONFIRMES", "Confirmés", compte.CONFIRMES],
    ["INSCRITS", "Confirmés + pré-inscrits", compte.INSCRITS],
    ["TOUS", "Tous (avec liste d'attente)", compte.TOUS],
  ] as const;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Envoyer cette annonce par email à ${n} personne${n > 1 ? "s" : ""} ?`)) e.preventDefault();
      }}
      className="flex flex-col gap-3.5 rounded-3xl border border-line bg-surface p-5"
    >
      <h2 className="text-[17px] font-extrabold">Nouvelle annonce</h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-bold text-muted">Destinataires</legend>
        <div className="flex flex-wrap gap-1.5">
          {options.map(([k, label, count]) => (
            <label key={k} className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] font-bold has-checked:border-accent has-checked:bg-accent has-checked:text-ink">
              <input type="radio" name="cible" value={k} checked={cible === k} onChange={() => setCible(k)} className="sr-only" />
              {label}
              <span className="opacity-70">{count}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
        Titre
        <input name="titre" required minLength={3} maxLength={120} placeholder="Ex. : Changement de salle, rappel du matériel…" className={`h-12 ${field}`} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
        <span className="flex justify-between">
          Message <span className={contenu.length > 2000 ? "text-danger" : "text-faint"}>{contenu.length} / 2000</span>
        </span>
        <textarea
          name="contenu"
          required
          minLength={10}
          maxLength={2000}
          rows={6}
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          placeholder="Laisse une ligne vide entre deux paragraphes."
          className={`resize-y py-3 leading-relaxed font-medium ${field}`}
        />
      </label>
      {state && (
        <span role={state.ok ? "status" : "alert"} className={`text-sm font-bold ${state.ok ? "text-accent" : "text-danger"}`}>
          {state.message}
        </span>
      )}
      <button type="submit" disabled={pending || n === 0 || restantes === 0} className="press h-13 rounded-full bg-accent font-extrabold text-ink disabled:opacity-50">
        {pending ? "Envoi…" : `Envoyer à ${n} personne${n > 1 ? "s" : ""}`}
      </button>
      <span className="text-[13px] leading-relaxed text-faint">
        Envoyé par email et affiché sur le billet des personnes concernées. {restantes > 0 ? `Encore ${restantes} annonce${restantes > 1 ? "s" : ""} possible${restantes > 1 ? "s" : ""} sur 24 h.` : "Limite de 24 h atteinte : réessaie plus tard."}
      </span>
    </form>
  );
}
