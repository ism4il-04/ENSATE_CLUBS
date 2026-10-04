"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { AdminResult } from "@/server/actions/admin";

/** Notification éphémère ; une nouvelle notification (nouvel `at`) remonte le composant. */
function Toast({ result }: { result: NonNullable<AdminResult> }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div role="status" className={`animate-toast fixed right-6 bottom-6 z-50 max-w-[calc(100%-48px)] rounded-[18px] px-4.5 py-3.5 text-sm font-extrabold text-ink shadow-2xl ${result.ok ? "bg-paper" : "bg-danger"}`}>
      {result.message}
    </div>
  );
}

/** Bouton qui appelle une Server Action liée (ex. activer / désactiver), avec confirmation facultative. */
export function ActionButton({ action, label, confirm, tone = "ghost" }: { action: () => Promise<AdminResult>; label: string; confirm?: string; tone?: "ghost" | "danger" | "accent" }) {
  const [result, setResult] = useState<AdminResult>(null);
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const cls = tone === "danger" ? "border-danger/60 text-danger" : tone === "accent" ? "border-accent bg-accent text-ink" : "border-line-strong";
  const run = () => start(async () => setResult(await action()));
  return (
    <>
      {asking ? (
        <span className="inline-flex gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setAsking(false);
              run();
            }}
            className="press h-9.5 rounded-full bg-danger px-3 text-[13px] font-extrabold text-ink"
          >
            {confirm}
          </button>
          <button type="button" onClick={() => setAsking(false)} className="press h-9.5 rounded-full border border-line-strong px-3 text-[13px] font-extrabold">
            Non
          </button>
        </span>
      ) : (
        <button type="button" disabled={pending} onClick={() => (confirm ? setAsking(true) : run())} className={`press h-9.5 rounded-full border px-3 text-[13px] font-extrabold whitespace-nowrap ${cls}`}>
          {label}
        </button>
      )}
      {result && <Toast key={result.at} result={result} />}
    </>
  );
}

/** Formulaire de création branché sur une Server Action (React vide le formulaire après succès). */
export function AdminForm({ action, submitLabel, children }: { action: (prev: AdminResult, fd: FormData) => Promise<AdminResult>; submitLabel: string; children: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {children}
      {state && !state.ok && (
        <span role="alert" className="text-[13px] font-bold text-danger">
          {state.message}
        </span>
      )}
      <button type="submit" disabled={pending} className="press h-12.5 rounded-full bg-accent font-extrabold text-ink">
        {pending ? "Création…" : submitLabel}
      </button>
      {state?.ok && <Toast key={state.at} result={state} />}
    </form>
  );
}
