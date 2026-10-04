"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { annulerEvenementAction } from "@/server/actions/annulation";

/** Zone sensible : annulation d'un événement, avec confirmation et motif envoyé aux inscrits. */
export function AnnulerEvenement({ eventId, titre, inscrits }: { eventId: string; titre: string; inscrits: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motif, setMotif] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const ready = confirm.trim().toLowerCase() === "annuler";

  if (result?.ok) {
    return (
      <p role="status" className="rounded-[22px] border border-line bg-surface p-4 text-sm font-bold text-accent">
        {result.message}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-danger/35 bg-danger/5 p-5">
      <div className="flex items-start gap-3">
        <Icon name="alert" size={20} className="mt-0.5 flex-none text-danger" />
        <div className="flex flex-col gap-1">
          <h2 className="font-extrabold">Annuler l&apos;événement</h2>
          <p className="text-[13px] leading-relaxed text-muted">
            Les billets ne seront plus valables et {inscrits > 0 ? `les ${inscrits} inscrits recevront un email` : "les inscrits éventuels recevront un email"}. Les remboursements se font directement par le club. Action définitive.
          </p>
        </div>
      </div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="press h-11 self-start rounded-full border-[1.5px] border-danger/60 px-4 text-sm font-extrabold text-danger">
          Annuler l&apos;événement…
        </button>
      ) : (
        <div className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
            Motif (envoyé aux inscrits, facultatif)
            <textarea
              rows={2}
              maxLength={500}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex. : intervenant indisponible, report au semestre prochain…"
              className="resize-y rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 py-3 font-medium text-paper outline-none focus:border-danger"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
            Tape « annuler » pour confirmer l&apos;annulation de « {titre} »
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              className="h-11 rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 font-semibold text-paper outline-none focus:border-danger"
            />
          </label>
          {result && !result.ok && (
            <span role="alert" className="text-sm font-bold text-danger">
              {result.message}
            </span>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!ready || pending}
              onClick={() =>
                start(async () => {
                  const r = await annulerEvenementAction(eventId, motif);
                  setResult(r);
                  if (r.ok) router.refresh();
                })
              }
              className="press h-11 rounded-full bg-danger px-5 text-sm font-extrabold text-ink disabled:opacity-40"
            >
              {pending ? "Annulation…" : "Confirmer l'annulation"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="press h-11 rounded-full px-4 text-sm font-bold text-muted">
              Garder l&apos;événement
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
