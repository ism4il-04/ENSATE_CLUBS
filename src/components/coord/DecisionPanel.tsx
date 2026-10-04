"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { deciderAction, type CoordResult } from "@/server/actions/coord";

export function DecisionPanel({ eventId, nextHref }: { eventId: string; nextHref: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [result, setResult] = useState<CoordResult | null>(null);
  const [shake, setShake] = useState(0);
  const [pending, start] = useTransition();

  const decide = (d: "VALIDE" | "REFUSE" | "MODIF_DEMANDEE") => {
    if (d !== "VALIDE" && !comment.trim()) {
      setResult({ ok: false, message: "Ajoute un commentaire pour expliquer ta décision au club." });
      setShake((n) => n + 1);
      return;
    }
    start(async () => {
      const r = await deciderAction(eventId, d, comment);
      setResult(r);
      if (r.ok) {
        setComment("");
        router.push(nextHref);
      }
    });
  };

  return (
    <div key={shake} className={`flex flex-col gap-2.5 border-t border-line pt-4.5 ${shake ? "animate-[rise_.3s_ease]" : ""}`}>
      <label htmlFor="commentaire" className="text-sm font-extrabold">
        Commentaire <span className="font-semibold text-muted">(obligatoire pour refuser ou demander une modification)</span>
      </label>
      <textarea
        id="commentaire"
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Ex. : merci de déplacer la scène ouverte en salle 201."
        className={`resize-y rounded-2xl border-[1.5px] bg-ink px-3.5 py-3 leading-relaxed font-medium outline-none focus:border-accent ${result && !result.ok ? "border-danger" : "border-line-strong"}`}
      />
      {result && (
        <span role={result.ok ? "status" : "alert"} className={`text-[13px] font-bold ${result.ok ? "text-accent" : "text-danger"}`}>
          {result.message}
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => decide("VALIDE")} className="press flex h-12.5 flex-[1_1_140px] items-center justify-center gap-2 rounded-full bg-accent font-extrabold text-ink">
          <Icon name="check" stroke={3} /> Valider
        </button>
        <button type="button" disabled={pending} onClick={() => decide("MODIF_DEMANDEE")} className="press h-12.5 flex-[1_1_220px] rounded-full border-[1.5px] border-amber font-extrabold text-amber">
          Demander une modification
        </button>
        <button type="button" disabled={pending} onClick={() => decide("REFUSE")} className="press h-12.5 flex-[1_1_120px] rounded-full border-[1.5px] border-danger font-extrabold text-danger">
          Refuser
        </button>
      </div>
    </div>
  );
}
