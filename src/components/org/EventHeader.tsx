import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { STATUT_EVENEMENT, type StatutEvenement } from "@/lib/statuts";

const TABS = [
  ["publication", "Publication"],
  ["inscrits", "Inscrits"],
  ["stand", "Stand"],
  ["controle", "Contrôle"],
  ["annonces", "Annonces"],
] as const;

// Inscrits : aussi après la fin ou l'annulation (remboursements, export). Stand et contrôle : événement publié seulement.
const VISIBLE: Record<(typeof TABS)[number][0], readonly string[]> = {
  publication: [],
  inscrits: ["PUBLIE", "TERMINE", "ANNULE"],
  stand: ["PUBLIE"],
  controle: ["PUBLIE"],
  annonces: ["PUBLIE", "TERMINE"],
};

export function EventHeader({
  id,
  titre,
  statut,
  current,
  partenaires,
  isPrincipal,
  base = "/org",
}: {
  id: string;
  titre: string;
  statut: StatutEvenement;
  current: (typeof TABS)[number][0];
  partenaires?: string;
  isPrincipal: boolean;
  base?: string;
}) {
  const st = STATUT_EVENEMENT[statut];
  const tabs = TABS.filter(([k]) => (k === "publication" ? isPrincipal && (statut === "VALIDE" || statut === "PUBLIE") : VISIBLE[k].includes(statut)));
  return (
    <>
      <Link href={base} className="flex min-h-10 items-center gap-1.5 self-start text-sm font-bold text-muted">
        <Icon name="chevronLeft" stroke={2.4} /> Mes événements
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div className="flex flex-col gap-2.5">
          <span className={`self-start rounded-full px-3 py-1 text-xs font-extrabold ${st.cls}`}>
            {st.label}
            {partenaires ? ` · avec ${partenaires}` : ""}
          </span>
          <h1 className="font-display text-[clamp(32px,4vw,46px)] leading-none font-extrabold tracking-[-0.04em]">{titre}</h1>
        </div>
        {tabs.length > 1 && (
          <nav aria-label="Sections de l'événement" className="flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
            {tabs.map(([k, label]) => (
              <Link
                key={k}
                href={`/org/evenements/${id}/${k}`}
                aria-current={current === k ? "page" : undefined}
                className={`flex h-10 items-center rounded-full px-3.5 text-sm ${current === k ? "bg-paper font-extrabold text-ink" : "font-semibold"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </>
  );
}
