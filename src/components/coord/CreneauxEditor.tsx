"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { remplacerCreneauxAction, type CoordResult } from "@/server/actions/coord";

type Lieu = { id: string; code: string; nom: string; type: string; etage: number | null };
type Row = { key: number; date: string; debut: string; fin: string; lieux: Record<string, boolean>; precision: string };

/** Édition des créneaux d'un événement validé ou publié, réservée au coordinateur (RG-08). */
export function CreneauxEditor({ eventId, lieux, initial }: { eventId: string; lieux: Lieu[]; initial: Omit<Row, "key">[] }) {
  const [rows, setRows] = useState<Row[]>(initial.map((r, i) => ({ ...r, key: i + 1 })));
  const [result, setResult] = useState<CoordResult | null>(null);
  const [pending, start] = useTransition();
  const autre = lieux.find((l) => l.code === "AUTRE");
  const upd = (key: number, p: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...p } : r)));

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <div key={r.key} className="flex flex-col gap-3 rounded-[20px] border border-line bg-ink p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-extrabold">Créneau {i + 1}</span>
            {rows.length > 1 && (
              <button type="button" aria-label={`Supprimer le créneau ${i + 1}`} onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))} className="grid size-9 place-items-center rounded-full border border-line-strong text-muted">
                <Icon name="x" size={15} stroke={2.4} />
              </button>
            )}
          </div>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
            {(
              [
                ["date", "Date", "date"],
                ["debut", "Début", "time"],
                ["fin", "Fin", "time"],
              ] as const
            ).map(([k, label, type]) => (
              <label key={k} className="flex flex-col gap-1 text-xs font-bold text-muted">
                {label}
                <input type={type} value={r[k]} onChange={(e) => upd(r.key, { [k]: e.target.value })} className="h-11 rounded-xl border-[1.5px] border-line-strong bg-surface px-2.5 font-semibold text-paper [color-scheme:dark] outline-none focus:border-accent" />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lieux.map((l) => {
              const on = !!r.lieux[l.id];
              return (
                <button key={l.id} type="button" aria-pressed={on} onClick={() => upd(r.key, { lieux: { ...r.lieux, [l.id]: !on } })} className={`h-9 rounded-lg border px-2.5 text-xs font-bold ${on ? "border-accent bg-accent text-ink" : "border-line bg-surface"}`}>
                  {l.type === "SALLE" ? l.code : l.code === "AUTRE" ? "Autre…" : l.nom}
                </button>
              );
            })}
          </div>
          {autre && r.lieux[autre.id] && (
            <input aria-label="Préciser le lieu « Autre »" value={r.precision} onChange={(e) => upd(r.key, { precision: e.target.value })} placeholder="Préciser le lieu" className="h-11 rounded-xl border-[1.5px] border-accent bg-surface px-3 font-semibold outline-none" />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((all) => [...all, { key: Date.now(), date: all.at(-1)?.date ?? "", debut: all.at(-1)?.debut ?? "14:00", fin: all.at(-1)?.fin ?? "16:00", lieux: {}, precision: "" }])}
        className="press h-11.5 rounded-2xl border-[1.5px] border-dashed border-line-strong text-sm font-extrabold"
      >
        + Ajouter un créneau
      </button>
      {result && <span className={`text-sm font-bold ${result.ok ? "text-accent" : "text-danger"}`}>{result.message}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () =>
            setResult(
              await remplacerCreneauxAction(
                eventId,
                rows.map((r) => ({
                  date: r.date,
                  debut: r.debut,
                  fin: r.fin,
                  lieux: Object.keys(r.lieux)
                    .filter((k) => r.lieux[k])
                    .map((idLieu) => ({ idLieu, precision: idLieu === autre?.id ? r.precision : undefined })),
                })),
              ),
            ),
          )
        }
        className="press h-12.5 rounded-full bg-accent font-extrabold text-ink"
      >
        {pending ? "Enregistrement…" : "Enregistrer les créneaux"}
      </button>
      <span className="text-xs text-faint">Les inscrits devront être prévenus du changement (notification automatique à venir).</span>
    </div>
  );
}
