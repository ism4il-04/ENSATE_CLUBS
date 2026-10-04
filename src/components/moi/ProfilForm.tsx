"use client";

import { useActionState, useState } from "react";
import { updateProfil, type ProfilState } from "@/server/actions/profil";

const NIVEAUX = ["CP1", "CP2", "1A", "2A", "3A"];

export function ProfilForm({ telephone, niveau, organisme, externe }: { telephone: string; niveau: string; organisme: string; externe: boolean }) {
  const [state, action, pending] = useActionState<ProfilState, FormData>(updateProfil, null);
  const [lvl, setLvl] = useState(niveau);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface p-4">
        <label htmlFor="telephone" className="font-extrabold">
          Téléphone
        </label>
        <input
          id="telephone"
          name="telephone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={telephone}
          placeholder="06 12 34 56 78"
          className="h-12.5 rounded-2xl border-[1.5px] border-line-strong bg-ink px-3.5 font-bold outline-none focus:border-accent"
        />
        <span className="text-[13px] text-muted">Visible uniquement par les organisateurs des événements qui le demandent.</span>
      </div>

      {externe ? (
        <div className="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface p-4">
          <label htmlFor="organisme" className="font-extrabold">
            Organisme <span className="font-semibold text-muted">(facultatif)</span>
          </label>
          <input
            id="organisme"
            name="organisme"
            maxLength={80}
            autoComplete="organization"
            defaultValue={organisme}
            placeholder="École, université, entreprise…"
            className="h-12.5 rounded-2xl border-[1.5px] border-line-strong bg-ink px-3.5 font-bold outline-none focus:border-accent"
          />
          <span className="text-[13px] text-muted">Affiché aux organisateurs des événements auxquels tu t&apos;inscris.</span>
        </div>
      ) : (
        <fieldset className="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface p-4">
          <legend className="sr-only">Niveau</legend>
          <span className="font-extrabold">
            Niveau <span className="font-semibold text-muted">(facultatif)</span>
          </span>
          <input type="hidden" name="niveau" value={lvl} />
          <div className="flex flex-wrap gap-1.5">
            {NIVEAUX.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={lvl === n}
                onClick={() => setLvl(lvl === n ? "" : n)}
                className={`press h-11 min-w-14 rounded-full border px-3.5 text-sm font-extrabold ${lvl === n ? "border-accent bg-accent text-ink" : "border-line-strong"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {state && (
        <span role="status" className={`text-sm font-bold ${state.ok ? "text-accent" : "text-danger"}`}>
          {state.message}
        </span>
      )}
      <button type="submit" disabled={pending} className="press h-13 rounded-full bg-accent font-extrabold text-ink">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
