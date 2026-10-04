"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { STATUT_INSCRIPTION } from "@/lib/statuts";
import {
  annulerInscriptionAction,
  annulerPaiementAction,
  attribuerPlaceAction,
  chercherEtudiantsAction,
  payerAction,
  trouverBilletAction,
  type CaisseResult,
} from "@/server/actions/caisse";
import { QrScanner } from "./QrScanner";

export type InscritRow = {
  id: string;
  nom: string;
  email: string;
  externe: boolean;
  organisme: string | null;
  telephone: string | null;
  source: "EN_LIGNE" | "STAND" | "MEMBRE";
  statut: keyof typeof STATUT_INSCRIPTION;
  paye: boolean;
  encaisseParMoi: boolean;
  encaissePar: string | null;
  tarif: string | null;
  montant: number | null;
  presences: boolean[];
};
type Tarif = { id: string; libelle: string; prix: number; affiche: boolean };

const SOURCE = { EN_LIGNE: "En ligne", STAND: "Stand", MEMBRE: "Membre" };
const TABS = [
  ["ALL", "Tous"],
  ["PRE", "À payer"],
  ["OK", "Confirmés"],
  ["MEM", "Membres"],
  ["WAIT", "Attente"],
  ["ANN", "Annulés"],
] as const;
type Tab = (typeof TABS)[number][0];

const inTab = (r: InscritRow, t: Tab) =>
  t === "ALL"
    ? r.statut !== "ANNULEE"
    : t === "PRE"
      ? r.statut === "PRE_INSCRITE"
      : t === "OK"
        ? r.statut === "CONFIRMEE" && r.source !== "MEMBRE"
        : t === "MEM"
          ? r.statut === "CONFIRMEE" && r.source === "MEMBRE"
          : t === "WAIT"
            ? r.statut === "LISTE_ATTENTE"
            : r.statut === "ANNULEE";

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function InscritsTable({
  eventId,
  rows,
  tarifs,
  gratuit,
  telephoneRequis,
  placesMembres,
  membresAttribues,
  compact = false,
}: {
  eventId: string;
  rows: InscritRow[];
  tarifs: Tarif[];
  gratuit: boolean;
  telephoneRequis: boolean;
  placesMembres: number;
  membresAttribues: number;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(compact ? "PRE" : "ALL");
  const [q, setQ] = useState("");
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<CaisseResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null); // inscription retrouvée par scan du billet
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<CaisseResult>) =>
    start(async () => {
      const r = await fn();
      setToast(r);
      setConfirmId(null);
    });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const list = useMemo(() => {
    const order = { PRE_INSCRITE: 0, LISTE_ATTENTE: 1, CONFIRMEE: 2, ANNULEE: 3 };
    if (focusId) return rows.filter((r) => r.id === focusId);
    return rows
      .filter((r) => inTab(r, tab) && (!q || norm(`${r.nom} ${r.email}`).includes(norm(q))))
      .sort((a, b) => order[a.statut] - order[b.statut]);
  }, [rows, tab, q, focusId]);

  // BF-39 : scanner le billet d'un participant pour le retrouver à la caisse.
  const onScan = (text: string) =>
    start(async () => {
      const r = await trouverBilletAction(eventId, text);
      if (r.ok) {
        setFocusId(r.id);
        setScanning(false);
      } else setToast({ ok: false, message: r.message });
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap justify-between gap-2.5">
        <div role="group" aria-label="Filtrer" className="flex flex-wrap gap-1.5">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
              className={`press flex h-10 items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold ${tab === k ? "border-paper bg-paper text-ink" : "border-line bg-surface"}`}
            >
              {label}
              <span className="font-extrabold opacity-70">{rows.filter((r) => inTab(r, k)).length}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setScanning(!scanning)}
          className={`press flex h-11 items-center gap-2 rounded-full px-4 text-sm font-extrabold ${scanning ? "border border-line-strong" : "bg-surface-2"}`}
        >
          <Icon name="ticket" size={16} />
          {scanning ? "Fermer la caméra" : "Scanner un billet"}
        </button>
        <label className="flex h-11 w-full max-w-[260px] items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-muted">
          <Icon name="search" size={16} />
          <span className="sr-only">Chercher un inscrit</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un nom…" className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-paper outline-none" />
        </label>
      </div>

      {scanning && (
        <div className="mx-auto w-full max-w-sm">
          <QrScanner active={scanning} onScan={(text) => !pending && onScan(text)} />
        </div>
      )}
      {focusId && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/8 px-4 py-2.5 text-sm font-bold">
          {list.length ? "Billet scanné : participant retrouvé." : "Ce participant n'apparaît plus dans la liste."}
          <button type="button" onClick={() => setFocusId(null)} className="press h-9 rounded-full border border-line-strong px-3 text-[13px] font-extrabold">
            Voir tous les inscrits
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-[22px] border border-line bg-surface">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wider text-muted uppercase">
              <th scope="col" className="px-4 py-3.5 font-extrabold">Participant</th>
              {telephoneRequis && <th scope="col" className="px-2 py-3.5 font-extrabold">Téléphone</th>}
              <th scope="col" className="px-2 py-3.5 font-extrabold">Source</th>
              <th scope="col" className="px-2 py-3.5 font-extrabold">Statut</th>
              <th scope="col" className="px-2 py-3.5 font-extrabold">Paiement</th>
              <th scope="col" className="px-2 py-3.5 font-extrabold">Présences</th>
              <th scope="col" className="px-4 py-3.5 text-right font-extrabold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const st = STATUT_INSCRIPTION[r.statut];
              const chosen = choice[r.id] ?? "";
              return (
                <tr key={r.id} className={`border-t border-line transition-colors hover:bg-hover ${r.statut === "ANNULEE" ? "opacity-55" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-extrabold">{r.nom}</div>
                    <div className="text-xs text-muted">
                      {r.email}
                      {r.externe && ` · externe${r.organisme ? ` (${r.organisme})` : ""}`}
                    </div>
                  </td>
                  {telephoneRequis && <td className="px-2 py-3 whitespace-nowrap text-soft tabular-nums">{r.telephone ?? "—"}</td>}
                  <td className="px-2 py-3 text-muted">{SOURCE[r.source]}</td>
                  <td className="px-2 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold whitespace-nowrap ${st.cls}`}>
                      <span className="size-1.5 rounded-full bg-current" />
                      {st.label}
                    </span>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-soft">
                    {r.source === "MEMBRE"
                      ? "Sans paiement"
                      : r.encaisseParMoi
                        ? `${r.tarif ?? "Tarif"} · ${r.montant} DH`
                        : r.paye
                          ? `Encaissé par ${r.encaissePar ?? "un partenaire"}`
                          : gratuit
                            ? "Gratuit"
                            : "À payer"}
                  </td>
                  <td className="px-2 py-3">
                    <span className="inline-flex gap-1">
                      {r.presences.map((p, i) => (
                        <span key={i} title={`Jour ${i + 1}`} className={`size-3 rounded ${p ? "bg-accent" : "bg-line"}`} />
                      ))}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {confirmId === r.id ? (
                        <>
                          <button type="button" disabled={pending} onClick={() => run(() => annulerInscriptionAction(eventId, r.id, r.nom))} className="press h-9.5 rounded-full bg-danger px-3 text-[13px] font-extrabold text-ink">
                            Confirmer l&apos;annulation
                          </button>
                          <button type="button" onClick={() => setConfirmId(null)} className="press h-9.5 rounded-full border border-line-strong px-3 text-[13px] font-extrabold">
                            Non
                          </button>
                        </>
                      ) : r.statut === "PRE_INSCRITE" ? (
                        <>
                          <select
                            aria-label={`Tarif de ${r.nom}`}
                            value={chosen}
                            onChange={(e) => setChoice((c) => ({ ...c, [r.id]: e.target.value }))}
                            className="h-9.5 rounded-xl border border-line-strong bg-ink px-2 text-[13px] font-bold [color-scheme:dark]"
                          >
                            <option value="">Choisir un tarif…</option>
                            {tarifs.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.libelle} · {t.prix} DH{t.affiche ? "" : " (masqué)"}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={pending || !chosen}
                            onClick={() => run(() => payerAction(eventId, r.id, chosen, r.nom))}
                            className="press h-9.5 rounded-full bg-accent px-3.5 text-[13px] font-extrabold text-ink"
                          >
                            Payé
                          </button>
                          <button type="button" onClick={() => setConfirmId(r.id)} className="press h-9.5 rounded-full border border-line-strong px-3 text-[13px] font-extrabold text-danger">
                            Annuler
                          </button>
                        </>
                      ) : r.statut === "ANNULEE" ? (
                        <span className="text-[13px] text-faint">—</span>
                      ) : r.paye && !r.encaisseParMoi ? (
                        <span className="text-[13px] text-faint">Géré par {r.encaissePar}</span>
                      ) : (
                        <>
                          {r.encaisseParMoi && (
                            <button type="button" disabled={pending} onClick={() => run(() => annulerPaiementAction(eventId, r.id, r.nom))} className="press h-9.5 rounded-full border border-line-strong px-3 text-[13px] font-extrabold">
                              Annuler le paiement
                            </button>
                          )}
                          <button type="button" onClick={() => setConfirmId(r.id)} className="press h-9.5 rounded-full border border-line-strong px-3 text-[13px] font-extrabold text-danger">
                            {r.source === "MEMBRE" ? "Retirer la place" : "Annuler l'inscription"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <p className="p-7 text-center text-muted">Aucun inscrit ne correspond.</p>}
      </div>

      {!compact && placesMembres > 0 && <PlacesMembres eventId={eventId} total={placesMembres} used={membresAttribues} onResult={setToast} />}

      {toast && (
        <div role="status" className={`animate-toast fixed right-6 bottom-24 z-40 max-w-[calc(100%-48px)] rounded-[18px] px-4.5 py-3.5 text-sm font-extrabold shadow-2xl md:bottom-6 ${toast.ok ? "bg-paper text-ink" : "bg-danger text-ink"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function PlacesMembres({ eventId, total, used, onResult }: { eventId: string; total: number; used: number; onResult: (r: CaisseResult) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; email: string; prenom: string; nom: string }[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (q.trim().length < 3) return;
    const t = setTimeout(() => start(async () => setResults(await chercherEtudiantsAction(eventId, q))), 300);
    return () => clearTimeout(t);
  }, [q, eventId]);

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] font-extrabold">Places membres</h2>
        <span className="text-sm text-muted">
          {used} attribuées sur {total} · {total - used} restantes
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.round((used / total) * 100)}%` }} />
      </div>
      <label className="flex h-11 items-center gap-2 rounded-[14px] border border-line-strong bg-ink px-3.5 text-muted">
        <Icon name="search" size={16} />
        <span className="sr-only">Chercher un étudiant à qui attribuer une place</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou email (3 lettres min.)" className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-paper outline-none" />
      </label>
      {q.trim().length >= 3 &&
        results.map((r) => (
          <div key={r.id} className="flex items-center gap-2.5 rounded-[14px] bg-ink p-2 pl-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold">
                {r.prenom} {r.nom}
              </span>
              <span className="block truncate text-xs text-muted">{r.email}</span>
            </span>
            <button
              type="button"
              disabled={pending || used >= total}
              onClick={() =>
                start(async () => {
                  onResult(await attribuerPlaceAction(eventId, r.id, `${r.prenom} ${r.nom}`));
                  setQ("");
                  setResults([]);
                })
              }
              className="press h-9.5 rounded-full bg-accent px-3 text-[13px] font-extrabold text-ink"
            >
              Attribuer
            </button>
          </div>
        ))}
      {q.trim().length >= 3 && !pending && results.length === 0 && <span className="text-[13px] text-faint">Aucun étudiant trouvé (il doit s&apos;être connecté une fois).</span>}
    </section>
  );
}
