"use client";

import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { fermerStandAction, ouvrirStandAction } from "@/server/actions/stand";
import { InscritsTable, type InscritRow } from "./InscritsTable";

type Props = {
  eventId: string;
  sessionId: string | null;
  orgNom: string;
  stats: { confirmes: number; publiques: number | null; pre: number; encaisse: number };
  rows: InscritRow[];
  tarifs: { id: string; libelle: string; prix: number; affiche: boolean }[];
  gratuit: boolean;
  telephoneRequis: boolean;
};

const CIRC = 2 * Math.PI * 26;

export function StandScreen(p: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"qr" | "caisse">("qr");
  const [svg, setSvg] = useState<string>("");
  const [remaining, setRemaining] = useState(30);
  const [closed, setClosed] = useState(false);
  const [pending, start] = useTransition();

  // Récupère le jeton courant, puis redessine le QR à chaque nouvelle fenêtre de 30 s.
  useEffect(() => {
    if (!p.sessionId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    let tick: ReturnType<typeof setInterval>;
    const load = async () => {
      const res = await fetch(`/api/stand/${p.sessionId}/jeton`, { cache: "no-store" }).catch(() => null);
      if (stop) return;
      if (!res || !res.ok) {
        if (res?.status === 410) setClosed(true);
        timer = setTimeout(load, 5000);
        return;
      }
      const { token, remainingMs } = (await res.json()) as { token: string; remainingMs: number };
      const url = `${window.location.origin}/api/stand/${p.sessionId}/entree?t=${encodeURIComponent(token)}`;
      setSvg(await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0B0C12", light: "#FFFFFF" } }));
      const end = Date.now() + remainingMs;
      clearInterval(tick);
      tick = setInterval(() => setRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 250);
      timer = setTimeout(load, remainingMs + 150);
    };
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [p.sessionId]);

  // Mode caisse : la liste se met à jour seule (nouvelles inscriptions au stand).
  useEffect(() => {
    if (mode !== "caisse") return;
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [mode, router]);

  if (!p.sessionId || closed) {
    return (
      <div className="flex flex-col items-center gap-4.5 rounded-[28px] border border-line bg-surface px-6 py-12 text-center">
        <span className="grid size-21 place-items-center rounded-[28px] border border-line bg-surface-2 text-muted">
          <Icon name="grid" size={34} />
        </span>
        <h2 className="font-display text-3xl font-extrabold tracking-tight">{closed ? "Session stand fermée" : "Ouvre ton stand"}</h2>
        <p className="max-w-[44ch] text-muted">
          Le QR affiché change toutes les 30 secondes : une photo partagée ailleurs ne permet pas de s&apos;inscrire. La session dure 8 heures.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await ouvrirStandAction(p.eventId);
              setClosed(false);
              router.refresh();
            })
          }
          className="press h-13.5 rounded-full bg-accent px-6.5 font-extrabold text-ink"
        >
          {pending ? "Ouverture…" : closed ? "Rouvrir la session" : "Ouvrir la session stand"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-3 pl-2 text-[13px] font-extrabold">
          <span className="animate-pulse-ring size-2.5 rounded-full bg-accent" />
          Stand ouvert · {p.orgNom}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => fermerStandAction(p.eventId, p.sessionId!).then(() => setClosed(true)))}
          className="press h-11 rounded-full border border-line-strong px-4 text-sm font-extrabold"
        >
          Fermer la session
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ["Confirmés", `${p.stats.confirmes}${p.stats.publiques !== null ? ` / ${p.stats.publiques}` : ""}`, "text-accent"],
          [p.gratuit ? "Inscrits" : "À payer", String(p.stats.pre), "text-amber"],
          ["Encaissé", `${p.stats.encaisse} DH`, "text-paper"],
        ].map(([k, v, c]) => (
          <div key={k} className="rounded-[18px] border border-line bg-surface p-3">
            <div className="text-xs font-semibold text-muted">{k}</div>
            <div className={`mt-1 font-display text-2xl font-extrabold ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      <div role="group" aria-label="Mode du stand" className="grid grid-cols-2 gap-1 rounded-full border border-line bg-surface p-1">
        {(
          [
            ["qr", "QR d'inscription"],
            ["caisse", `Caisse${p.stats.pre ? ` (${p.stats.pre})` : ""}`],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={`h-11 rounded-full text-sm font-extrabold ${mode === k ? "bg-accent text-ink" : ""}`}>
            {label}
          </button>
        ))}
      </div>

      {mode === "qr" ? (
        <div className="flex flex-col items-center gap-4.5">
          <div
            key={svg.length ? svg.slice(-40) : "empty"}
            className="animate-rise w-[min(100%,360px)] rounded-[30px] bg-white p-5 shadow-[0_0_0_6px_#1e2030]"
            role="img"
            aria-label="QR code d'inscription, renouvelé toutes les 30 secondes"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="flex w-full max-w-[360px] items-center gap-3.5 rounded-[22px] border border-line bg-surface px-3.5 py-3">
            <svg width="60" height="60" viewBox="0 0 64 64" aria-hidden className="flex-none">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#2B2E40" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="#C6F24E"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - remaining / 30)}
                transform="rotate(-90 32 32)"
                style={{ transition: "stroke-dashoffset .25s linear" }}
              />
              <text x="32" y="39" textAnchor="middle" fill="#F4F3EF" style={{ font: "800 19px var(--font-bricolage)" }}>
                {remaining}
              </text>
            </svg>
            <div className="flex flex-col gap-0.5">
              <span className="font-extrabold">Nouveau code dans {remaining} s</span>
              <span className="text-[13px] leading-snug text-muted">Les étudiants scannent avec l&apos;appareil photo, puis se connectent avec Google.</span>
            </div>
          </div>
        </div>
      ) : (
        <InscritsTable eventId={p.eventId} rows={p.rows} tarifs={p.tarifs} gratuit={p.gratuit} telephoneRequis={p.telephoneRequis} placesMembres={0} membresAttribues={0} compact />
      )}
    </div>
  );
}
