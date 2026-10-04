"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { ajouterMembreAction, changerRoleAction, chercherCandidatsAction, retirerMembreAction, type MembreResult } from "@/server/actions/membres";

type Role = "PRESIDENT" | "TRESORIER" | "MEMBRE";
type Membre = { id: string; role: Role; annee: string; idCompte: string; email: string; nom: string };

const ROLES: [Role, string, string][] = [
  ["PRESIDENT", "Président·e", "Tout : événements, publication, membres, trésorerie"],
  ["TRESORIER", "Trésorier·e", "Trésorerie, stand, caisse, contrôle"],
  ["MEMBRE", "Membre", "Stand, caisse, contrôle d'entrée"],
];
const select = "h-10 rounded-xl border border-line-strong bg-ink px-2 text-[13px] font-bold text-paper [color-scheme:dark]";

export function MembresScreen({ membres, moi }: { membres: Membre[]; moi: string }) {
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<{ id: string; email: string; prenom: string; nom: string }[]>([]);
  const [role, setRole] = useState<Role>("MEMBRE");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<MembreResult | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) return;
    const id = setTimeout(async () => setResultats(await chercherCandidatsAction(t)), 250);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const run = (fn: () => Promise<MembreResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setToast(r);
      setConfirmId(null);
      if (r.ok) after?.();
    });
  const dejaMembre = new Set(membres.map((m) => m.idCompte));
  const visibles = q.trim().length >= 3 ? resultats : [];

  return (
    <div className="flex flex-wrap items-start gap-5">
      <section className="flex min-w-0 flex-[999_1_520px] flex-col gap-2.5">
        {membres.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-[20px] border border-line bg-surface px-4 py-3">
            <span className="grid size-10 flex-none place-items-center rounded-full bg-surface-2 font-extrabold">{m.nom.slice(0, 2).toUpperCase()}</span>
            <div className="flex min-w-0 flex-[1_1_200px] flex-col">
              <span className="truncate font-extrabold">
                {m.nom}
                {m.idCompte === moi && <span className="font-semibold text-muted"> (toi)</span>}
              </span>
              <span className="truncate text-[13px] text-muted">
                {m.email} · {m.annee}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <select
                aria-label={`Rôle de ${m.nom}`}
                value={m.role}
                disabled={pending || m.idCompte === moi}
                onChange={(e) => run(() => changerRoleAction(m.id, e.target.value as Role))}
                className={select}
              >
                {ROLES.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              {m.idCompte !== moi &&
                (confirmId === m.id ? (
                  <>
                    <button type="button" disabled={pending} onClick={() => run(() => retirerMembreAction(m.id, m.nom))} className="press h-10 rounded-full bg-danger px-3 text-[13px] font-extrabold text-ink">
                      Retirer
                    </button>
                    <button type="button" onClick={() => setConfirmId(null)} className="press h-10 rounded-full border border-line-strong px-3 text-[13px] font-extrabold">
                      Non
                    </button>
                  </>
                ) : (
                  <button type="button" aria-label={`Retirer ${m.nom}`} onClick={() => setConfirmId(m.id)} className="press grid size-10 place-items-center rounded-full border border-line-strong text-danger">
                    <Icon name="x" size={16} stroke={2.6} />
                  </button>
                ))}
            </div>
          </div>
        ))}
        {!membres.length && <p className="rounded-[20px] border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">Aucun membre pour l&apos;instant. Ajoute ton bureau à droite.</p>}
        <div className="grid gap-2 text-[13px] [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          {ROLES.map(([k, label, droits]) => (
            <div key={k} className="rounded-2xl border border-line bg-surface px-3.5 py-2.5">
              <b>{label}</b>
              <div className="text-muted">{droits}</div>
            </div>
          ))}
        </div>
      </section>

      <aside className="flex flex-[1_1_320px] flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
        <h2 className="text-lg font-extrabold">Ajouter un membre</h2>
        <div role="group" aria-label="Rôle du nouveau membre" className="grid grid-cols-3 gap-1 rounded-full border border-line bg-ink p-1">
          {ROLES.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={role === k} onClick={() => setRole(k)} className={`h-10 rounded-full text-[12px] font-extrabold ${role === k ? "bg-accent text-ink" : ""}`}>
              {label}
            </button>
          ))}
        </div>
        <label className="flex h-12 items-center gap-2 rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 text-muted focus-within:border-accent">
          <Icon name="search" size={16} />
          <span className="sr-only">Chercher une personne</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou email (3 lettres min.)" className="min-w-0 flex-1 bg-transparent font-semibold text-paper outline-none" />
        </label>
        <div className="flex flex-col gap-1.5">
          {visibles.map((r) => {
            const nom = [r.prenom, r.nom].filter(Boolean).join(" ") || r.email;
            return (
              <div key={r.id} className="flex items-center gap-2 rounded-2xl border border-line bg-ink px-3 py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-extrabold">{nom}</span>
                  <span className="truncate text-xs text-muted">{r.email}</span>
                </div>
                {dejaMembre.has(r.id) ? (
                  <span className="text-xs font-bold text-muted">Déjà membre</span>
                ) : (
                  <button type="button" disabled={pending} onClick={() => run(() => ajouterMembreAction(r.id, role, nom), () => setQ(""))} className="press h-9 rounded-full bg-accent px-3 text-[13px] font-extrabold text-ink">
                    Ajouter
                  </button>
                )}
              </div>
            );
          })}
          {q.trim().length >= 3 && !visibles.length && <span className="text-[13px] text-muted">Personne trouvée. La personne doit s&apos;être connectée au moins une fois sur la plateforme.</span>}
        </div>
        <p className="text-[13px] leading-relaxed text-faint">
          Chaque membre se connecte avec son propre compte Google et retrouve l&apos;espace du club depuis le menu. Le compte commun du club garde tous les droits.
        </p>
      </aside>

      {toast && (
        <div role="status" className={`animate-toast fixed right-6 bottom-24 z-40 max-w-[calc(100%-48px)] rounded-[18px] px-4.5 py-3.5 text-sm font-extrabold shadow-2xl md:bottom-6 ${toast.ok ? "bg-paper text-ink" : "bg-danger text-ink"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
