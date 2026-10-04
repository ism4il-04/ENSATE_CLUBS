import type { Metadata } from "next";
import Link from "next/link";
import { dateStamp, rangeLabel } from "@/lib/format";
import { requireUser } from "@/server/permissions";
import { listMyInscriptions, splitByPeriod } from "@/server/queries/moi";

export const metadata: Metadata = { title: "Mes billets" };

const BADGE: Record<string, { label: string; cls: string }> = {
  CONFIRMEE: { label: "Confirmé", cls: "bg-accent/15 text-accent" },
  PRE_INSCRITE: { label: "Pré-inscrit · à payer", cls: "bg-amber/15 text-amber" },
  LISTE_ATTENTE: { label: "Liste d'attente", cls: "bg-sky/15 text-sky" },
};

export default async function MesBillets({ searchParams }: PageProps<"/moi/billets">) {
  const user = await requireUser("/moi/billets");
  const tab = (await searchParams).periode === "passes" ? "passes" : "avenir";
  const { avenir, passes } = splitByPeriod(await listMyInscriptions(user.id));
  const list = tab === "avenir" ? avenir : passes;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-[40px] leading-none font-extrabold tracking-[-0.045em]">Mes billets</h1>
        <span className="text-sm font-bold text-muted">{avenir.length} à venir</span>
      </div>
      <nav aria-label="Période" className="grid grid-cols-2 gap-1 rounded-full border border-line bg-surface p-1">
        {[
          ["avenir", "À venir"],
          ["passes", "Passés"],
        ].map(([k, label]) => (
          <Link
            key={k}
            href={k === "avenir" ? "/moi/billets" : "/moi/billets?periode=passes"}
            aria-current={tab === k ? "page" : undefined}
            className={`press flex h-11 items-center justify-center rounded-full text-sm font-extrabold ${tab === k ? "bg-paper text-ink" : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {list.map(({ ins, evt, debut, fin }, i) => {
        const st = debut ? dateStamp(debut) : null;
        const b = BADGE[ins.statut] ?? BADGE.CONFIRMEE;
        return (
          <Link
            key={ins.id}
            href={`/moi/billets/${ins.id}`}
            className="lift animate-rise flex items-center gap-3 rounded-3xl border border-line bg-surface p-3"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="flex size-16.5 flex-none flex-col items-center justify-center rounded-[18px] leading-none text-ink" style={{ background: evt.couleur }}>
              <span className="text-[11px] font-extrabold tracking-widest">{st?.dow}</span>
              <span className="mt-0.5 font-display text-[26px] font-extrabold">{st?.day}</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="leading-tight font-extrabold">{evt.titre}</span>
              <span className="text-[13px] text-muted">{debut && fin ? rangeLabel(debut, fin) : ""}</span>
              <span className={`flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-extrabold ${b.cls}`}>
                <span className="size-1.5 rounded-full bg-current" />
                {ins.datePaiement ? `${b.label} · payé` : b.label}
              </span>
            </span>
          </Link>
        );
      })}

      {list.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border-[1.5px] border-dashed border-line-strong px-5 py-10 text-center">
          <span className="font-display text-2xl font-extrabold">{tab === "avenir" ? "Aucun billet à venir" : "Aucun événement passé"}</span>
          <Link href="/" className="press rounded-full bg-accent px-5 py-3 text-sm font-extrabold text-ink">
            Trouver un événement
          </Link>
        </div>
      )}
    </section>
  );
}
