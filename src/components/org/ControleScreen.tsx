"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { checkinAction, type CheckinView } from "@/server/actions/checkin";
import { QrScanner } from "./QrScanner";

type Creneau = { id: string; label: string; sub: string; presents: number; today: boolean };
type Participant = { id: string; nom: string; confirme: boolean; presences: string[] };

const VIEW: Record<CheckinView["kind"], { bg: string; title: string; icon: "check" | "alert" | "x" }> = {
  VALIDE: { bg: "bg-accent", title: "Entrée validée", icon: "check" },
  DEJA_PRESENT: { bg: "bg-amber", title: "Déjà scanné", icon: "alert" },
  NON_CONFIRMEE: { bg: "bg-danger", title: "Non confirmé", icon: "x" },
  BILLET_INVALIDE: { bg: "bg-danger", title: "Billet invalide", icon: "x" },
  EVENEMENT_ANNULE: { bg: "bg-danger", title: "Événement annulé", icon: "x" },
  CRENEAU_HORS_JOUR: { bg: "bg-danger", title: "Pas aujourd'hui", icon: "x" },
  ACCES_REFUSE: { bg: "bg-danger", title: "Accès refusé", icon: "x" },
};

function detail(r: CheckinView) {
  switch (r.kind) {
    case "VALIDE":
      return r.nom;
    case "DEJA_PRESENT":
      return `${r.nom} · entré à ${new Date(r.a).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" })}`;
    case "NON_CONFIRMEE":
      return `${r.nom} · ${r.statut === "PRE_INSCRITE" ? "paiement non enregistré" : "inscription non confirmée"}`;
    case "BILLET_INVALIDE":
      return "Ce billet ne correspond pas à cet événement.";
    case "CRENEAU_HORS_JOUR":
      return "Ce créneau n'a pas lieu aujourd'hui.";
    case "EVENEMENT_ANNULE":
      return "Cet événement a été annulé : aucune entrée n'est validée.";
    default:
      return "";
  }
}

export function ControleScreen({ eventId, creneaux, participants, confirmes }: { eventId: string; creneaux: Creneau[]; participants: Participant[]; confirmes: number }) {
  const [creneauId, setCreneauId] = useState(creneaux.find((c) => c.today)?.id ?? creneaux[0]?.id ?? "");
  const [counts, setCounts] = useState<Record<string, number>>(Object.fromEntries(creneaux.map((c) => [c.id, c.presents])));
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<CheckinView | null>(null);
  const [history, setHistory] = useState<{ t: string; r: CheckinView }[]>([]);
  const [q, setQ] = useState("");
  const [admitted, setAdmitted] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!result) return;
    if ("vibrate" in navigator) navigator.vibrate(result.kind === "VALIDE" ? 80 : [60, 60, 60]);
    const t = setTimeout(() => setResult(null), 2200);
    return () => clearTimeout(t);
  }, [result]);

  const submit = (input: { token?: string; inscriptionId?: string }) =>
    start(async () => {
      const r = await checkinAction(eventId, creneauId, input);
      setResult(r);
      if (r.kind === "VALIDE") setCounts((c) => ({ ...c, [creneauId]: (c[creneauId] ?? 0) + 1 }));
      if (r.kind === "VALIDE" && input.inscriptionId) setAdmitted((a) => ({ ...a, [`${creneauId}:${input.inscriptionId}`]: true }));
      setHistory((h) => [{ t: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), r }, ...h].slice(0, 5));
    });

  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const matches = useMemo(() => (q.trim().length >= 2 ? participants.filter((p) => norm(p.nom).includes(norm(q))).slice(0, 6) : []), [q, participants]);

  if (!creneaux.length) return <p className="text-muted">Aucun créneau pour cet événement.</p>;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div role="group" aria-label="Créneau" className="grid gap-1 rounded-[18px] border border-line bg-surface p-1" style={{ gridTemplateColumns: `repeat(${Math.min(creneaux.length, 3)}, minmax(0, 1fr))` }}>
        {creneaux.map((c) => (
          <button key={c.id} type="button" aria-pressed={creneauId === c.id} onClick={() => setCreneauId(c.id)} className={`flex h-13.5 flex-col items-center justify-center rounded-[14px] ${creneauId === c.id ? "bg-accent text-ink" : ""}`}>
            <span className="text-sm font-extrabold">{c.label}</span>
            <span className="text-xs font-semibold opacity-80">{c.sub}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-[18px] border border-line bg-surface px-4 py-3">
        <span className="text-sm font-bold text-muted">Présents</span>
        <span key={counts[creneauId]} className="animate-rise font-display text-2xl font-extrabold text-accent">
          {counts[creneauId] ?? 0}
          <span className="text-[15px] text-muted"> / {confirmes}</span>
        </span>
      </div>

      <QrScanner active={scanning} onScan={(text) => !pending && submit({ token: text })} />
      <button type="button" onClick={() => setScanning(!scanning)} className={`press h-14 rounded-full font-extrabold ${scanning ? "border border-line-strong" : "bg-accent text-ink"}`}>
        {scanning ? "Mettre la caméra en pause" : "Scanner les billets"}
      </button>

      <label className="flex h-12.5 items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-muted">
        <Icon name="search" />
        <span className="sr-only">Recherche manuelle par nom</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pas de billet ? Cherche le nom…" className="min-w-0 flex-1 bg-transparent font-semibold text-paper outline-none" />
      </label>
      {matches.map((p) => {
        const done = admitted[`${creneauId}:${p.id}`] || p.presences.includes(creneauId);
        return (
          <div key={p.id} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface py-2.5 pr-2.5 pl-3.5">
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">{p.nom}</span>
              <span className="block text-xs text-muted">{!p.confirme ? "Pré-inscrit · non payé" : done ? "Déjà entré" : "Confirmé"}</span>
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => submit({ inscriptionId: p.id })}
              className={`press h-10.5 rounded-full px-3.5 text-[13px] font-extrabold text-ink ${!p.confirme ? "bg-danger" : done ? "bg-amber" : "bg-accent"}`}
            >
              {!p.confirme ? "Vérifier" : done ? "Déjà entré" : "Valider l'entrée"}
            </button>
          </div>
        );
      })}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-extrabold tracking-wider text-faint uppercase">Derniers passages</span>
        {history.map((h, i) => (
          <div key={i} className="flex items-center gap-2.5 text-sm">
            <span className={`size-2.5 rounded-full ${VIEW[h.r.kind].bg}`} />
            <span className="flex-1 font-bold">{"nom" in h.r ? h.r.nom : VIEW[h.r.kind].title}</span>
            <span className="text-muted">{h.t}</span>
          </div>
        ))}
        {!history.length && <span className="text-sm text-faint">Aucun passage pour l&apos;instant.</span>}
      </div>

      {result && (
        <button
          type="button"
          onClick={() => setResult(null)}
          aria-label="Scan suivant"
          className={`animate-rise fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-7 text-center text-ink ${VIEW[result.kind].bg}`}
        >
          <span className="grid size-30 place-items-center rounded-full bg-ink text-paper">
            <Icon name={VIEW[result.kind].icon} size={56} stroke={3} />
          </span>
          <span role="status" className="font-display text-[40px] leading-[0.95] font-extrabold tracking-tight">
            {VIEW[result.kind].title}
          </span>
          <span className="max-w-[30ch] text-lg font-bold">{detail(result)}</span>
          <span className="mt-5 rounded-full bg-ink px-5.5 py-3 text-[15px] font-extrabold text-paper">Toucher pour continuer</span>
        </button>
      )}
    </div>
  );
}
