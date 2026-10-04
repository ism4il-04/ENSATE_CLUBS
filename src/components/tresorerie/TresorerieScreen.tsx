"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { enregistrerTransactionAction, supprimerTransactionAction, synchroniserBilletterieAction, type TresorerieResult } from "@/server/actions/tresorerie";

type Tx = {
  id: string;
  type: "RECETTE" | "DEPENSE";
  montant: number;
  libelle: string;
  categorie: string;
  dateOperation: string;
  idEvenement: string | null;
  evenement: string | null;
  justificatif: string | null;
};
type Resume = {
  recettes: number;
  depenses: number;
  solde: number;
  parCategorie: { categorie: string; recettes: number; depenses: number }[];
  parEvenement: { id: string; titre: string; solde: number; recettes: number; depenses: number }[];
};
type Vente = { idEvenement: string; titre: string; encaisse: number; paiements: number; saisie: number | null };
type Filtres = { type?: string; evenement?: string; du?: string; au?: string };

const dh = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} DH`;
const field = "h-12 min-w-0 rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 font-semibold text-paper outline-none focus:border-accent";
const dateFr = (d: string) => d.split("-").reverse().join("/");

/** Envoi d'un justificatif dans le dossier privé de l'organisation (Cloudinary « authenticated »). */
async function envoyerJustificatif(file: File): Promise<string> {
  const ok = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!ok.includes(file.type)) throw new Error("Formats acceptés : photo (JPG, PNG, WebP) ou PDF.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Fichier trop lourd (10 Mo maximum).");
  const res = await fetch("/api/tresorerie/justificatif", { method: "POST" });
  const sig = await res.json().catch(() => null);
  if (!res.ok) throw new Error(res.status === 503 ? "L'envoi de fichiers n'est pas configuré." : "Impossible de préparer l'envoi.");
  const body = new FormData();
  body.append("file", file);
  for (const k of ["api_key", "timestamp", "signature", "folder", "allowed_formats", "type"] as const) body.append(k, String(k === "api_key" ? sig.apiKey : sig[k]));
  const up = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: "POST", body });
  const r = await up.json().catch(() => null);
  if (!up.ok || typeof r?.public_id !== "string" || typeof r?.format !== "string") throw new Error(r?.error?.message ?? "Le fichier a été refusé.");
  return `${r.format}:${r.public_id}`;
}

function Formulaire({
  initial,
  aujourdhui,
  categories,
  evenements,
  uploads,
  onDone,
  onCancel,
}: {
  initial: Tx | null;
  aujourdhui: string;
  categories: string[];
  evenements: { id: string; titre: string }[];
  uploads: boolean;
  onDone: (r: TresorerieResult) => void;
  onCancel?: () => void;
}) {
  const [type, setType] = useState<"RECETTE" | "DEPENSE">(initial?.type ?? "DEPENSE");
  const [montant, setMontant] = useState(initial ? String(initial.montant) : "");
  const [libelle, setLibelle] = useState(initial?.libelle ?? "");
  const [categorie, setCategorie] = useState(initial?.categorie ?? "Matériel");
  const [date, setDate] = useState(initial?.dateOperation ?? aujourdhui);
  const [evt, setEvt] = useState(initial?.idEvenement ?? "");
  const [justif, setJustif] = useState<string | null>(initial?.justificatif ?? null);
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const m = Number(montant.replace(",", "."));
    start(async () => {
      const r = await enregistrerTransactionAction(initial?.id ?? null, {
        type,
        montant: Number.isFinite(m) ? m : NaN,
        libelle,
        categorie: categorie as "Autre",
        dateOperation: date,
        idEvenement: evt || null,
        justificatif: justif,
      });
      if (r.ok) onDone(r);
      else setErreur(r.message);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div role="group" aria-label="Type d'opération" className="grid grid-cols-2 gap-1 rounded-full border border-line bg-ink p-1">
        {(
          [
            ["DEPENSE", "Dépense"],
            ["RECETTE", "Recette"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)} className={`h-10 rounded-full text-sm font-extrabold ${type === k ? (k === "RECETTE" ? "bg-accent text-ink" : "bg-coral text-ink") : ""}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
          Montant (DH)
          <input required inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0,00" className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
          Date
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} [color-scheme:dark]`} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
        Libellé
        <input required maxLength={120} value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. : impression des affiches" className={field} />
      </label>
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
          Catégorie
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={`${field} [color-scheme:dark]`}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
          Événement (facultatif)
          <select value={evt} onChange={(e) => setEvt(e.target.value)} className={`${field} [color-scheme:dark]`}>
            <option value="">Aucun</option>
            {evenements.map((e) => (
              <option key={e.id} value={e.id}>
                {e.titre}
              </option>
            ))}
          </select>
        </label>
      </div>
      {uploads && (
        <div className="flex flex-wrap items-center gap-2.5 text-[13px] font-bold text-muted">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setEnvoi(true);
              setErreur(null);
              try {
                setJustif(await envoyerJustificatif(f));
                setNomFichier(f.name);
              } catch (err) {
                setErreur(err instanceof Error ? err.message : "Échec de l'envoi.");
              } finally {
                setEnvoi(false);
                if (fileRef.current) fileRef.current.value = "";
              }
            }}
          />
          <button type="button" disabled={envoi} onClick={() => fileRef.current?.click()} className="press flex h-11 items-center gap-2 rounded-full border-[1.5px] border-line-strong px-4 text-sm font-extrabold text-paper">
            <Icon name="upload" size={16} stroke={2.2} />
            {envoi ? "Envoi…" : justif ? "Remplacer le justificatif" : "Joindre un justificatif"}
          </button>
          {justif && (
            <>
              <span className="text-accent">✓ {nomFichier ?? "justificatif joint"}</span>
              <button type="button" onClick={() => setJustif(null)} className="text-faint underline underline-offset-2">
                retirer
              </button>
            </>
          )}
        </div>
      )}
      {erreur && (
        <span role="alert" className="text-sm font-bold text-danger">
          {erreur}
        </span>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending || envoi} className="press h-12.5 flex-1 rounded-full bg-accent font-extrabold text-ink disabled:opacity-50">
          {pending ? "Enregistrement…" : initial ? "Enregistrer les modifications" : type === "RECETTE" ? "Ajouter la recette" : "Ajouter la dépense"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="press h-12.5 rounded-full border border-line-strong px-4 text-sm font-extrabold">
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

export function TresorerieScreen(p: {
  aujourdhui: string;
  uploads: boolean;
  categories: string[];
  evenements: { id: string; titre: string }[];
  filtres: Filtres;
  resume: Resume;
  billetterie: Vente[];
  transactions: Tx[];
}) {
  const router = useRouter();
  const [edition, setEdition] = useState<Tx | null>(null);
  const [cle, setCle] = useState(0); // remonte le formulaire d'ajout après un enregistrement
  const [toast, setToast] = useState<TresorerieResult | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const done = (r: TresorerieResult) => {
    setToast(r);
    setEdition(null);
    setCle((k) => k + 1);
    router.refresh();
  };
  const filtreHref = (patch: Filtres) => {
    const q = new URLSearchParams(Object.entries({ ...p.filtres, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/org/tresorerie${q.size ? `?${q}` : ""}`;
  };
  const filtrage = !!(p.filtres.type || p.filtres.evenement || p.filtres.du || p.filtres.au);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <div className={`rounded-[22px] p-4.5 ${p.resume.solde >= 0 ? "bg-accent text-ink" : "bg-danger text-ink"}`}>
          <div className="text-[13px] font-bold opacity-75">Solde</div>
          <div className="mt-1 font-display text-[34px] leading-none font-extrabold tracking-tight">{dh(p.resume.solde)}</div>
        </div>
        <div className="rounded-[22px] border border-line bg-surface p-4.5">
          <div className="text-[13px] font-bold text-muted">Recettes</div>
          <div className="mt-1 font-display text-[28px] leading-none font-extrabold text-accent">{dh(p.resume.recettes)}</div>
        </div>
        <div className="rounded-[22px] border border-line bg-surface p-4.5">
          <div className="text-[13px] font-bold text-muted">Dépenses</div>
          <div className="mt-1 font-display text-[28px] leading-none font-extrabold text-coral">{dh(p.resume.depenses)}</div>
        </div>
      </div>

      {p.billetterie.length > 0 && (
        <section className="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface p-5">
          <h2 className="text-[17px] font-extrabold">Billetterie encaissée par ton organisation</h2>
          <p className="text-[13px] text-muted">Crée ou mets à jour la recette « Billetterie » à partir des paiements marqués à la caisse.</p>
          {p.billetterie.map((v) => {
            const aJour = v.saisie !== null && Math.abs(v.saisie - v.encaisse) < 0.005;
            return (
              <div key={v.idEvenement} className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-line bg-ink px-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-extrabold">{v.titre}</span>
                  <span className="text-[13px] text-muted">
                    {dh(v.encaisse)} encaissés · {v.paiements} paiement{v.paiements > 1 ? "s" : ""}
                    {v.saisie !== null && !aJour ? ` · saisi : ${dh(v.saisie)}` : ""}
                  </span>
                </div>
                {aJour ? (
                  <span className="text-[13px] font-extrabold text-accent">✓ À jour</span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => start(async () => done(await synchroniserBilletterieAction(v.idEvenement)))}
                    className="press h-10 rounded-full bg-accent px-4 text-[13px] font-extrabold text-ink"
                  >
                    {v.saisie === null ? "Créer la recette" : "Mettre à jour"}
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <section className="flex min-w-0 flex-[999_1_520px] flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div role="group" aria-label="Filtrer par type" className="flex gap-1.5">
              {(
                [
                  [undefined, "Tout"],
                  ["RECETTE", "Recettes"],
                  ["DEPENSE", "Dépenses"],
                ] as const
              ).map(([k, label]) => (
                <Link key={label} href={filtreHref({ type: k })} aria-current={p.filtres.type === k ? "page" : undefined} className={`press flex h-10 items-center rounded-full border px-3.5 text-[13px] font-bold ${p.filtres.type === k ? "border-paper bg-paper text-ink" : "border-line bg-surface"}`}>
                  {label}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Filtrer par événement"
                value={p.filtres.evenement ?? ""}
                onChange={(e) => router.push(filtreHref({ evenement: e.target.value || undefined }))}
                className="h-10 max-w-[220px] rounded-full border border-line bg-surface px-3 text-[13px] font-bold [color-scheme:dark]"
              >
                <option value="">Tous les événements</option>
                {p.evenements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.titre}
                  </option>
                ))}
              </select>
              <a href="/org/tresorerie/export" className="press flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] font-extrabold">
                Exporter (CSV)
              </a>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-[22px] border border-line bg-surface">
            {p.transactions.map((t) =>
              edition?.id === t.id ? (
                <div key={t.id} className="border-b border-line p-4 last:border-b-0">
                  <Formulaire initial={t} aujourdhui={p.aujourdhui} categories={p.categories} evenements={p.evenements} uploads={p.uploads} onDone={done} onCancel={() => setEdition(null)} />
                </div>
              ) : (
                <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0">
                  <span className={`grid size-9 flex-none place-items-center rounded-xl text-lg font-extrabold text-ink ${t.type === "RECETTE" ? "bg-accent" : "bg-coral"}`}>{t.type === "RECETTE" ? "+" : "−"}</span>
                  <div className="flex min-w-0 flex-[1_1_200px] flex-col">
                    <span className="truncate font-extrabold">{t.libelle}</span>
                    <span className="truncate text-[13px] text-muted">
                      {dateFr(t.dateOperation)} · {t.categorie}
                      {t.evenement ? ` · ${t.evenement}` : ""}
                    </span>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                  <span className={`font-display text-lg font-extrabold whitespace-nowrap ${t.type === "RECETTE" ? "text-accent" : "text-coral"}`}>
                    {t.type === "RECETTE" ? "+" : "−"} {dh(t.montant)}
                  </span>
                  <div className="flex items-center gap-1">
                    {t.justificatif && (
                      <a href={`/org/tresorerie/${t.id}/justificatif`} target="_blank" rel="noopener noreferrer" aria-label={`Justificatif : ${t.libelle}`} className="press grid size-9 place-items-center rounded-full border border-line-strong text-soft">
                        <Icon name="image" size={16} />
                      </a>
                    )}
                    {confirmId === t.id ? (
                      <>
                        <button type="button" disabled={pending} onClick={() => start(async () => { done(await supprimerTransactionAction(t.id)); setConfirmId(null); })} className="press h-9 rounded-full bg-danger px-3 text-[13px] font-extrabold text-ink">
                          Supprimer
                        </button>
                        <button type="button" onClick={() => setConfirmId(null)} className="press h-9 rounded-full border border-line-strong px-3 text-[13px] font-extrabold">
                          Non
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setEdition(t)} className="press h-9 rounded-full border border-line-strong px-3 text-[13px] font-extrabold">
                          Modifier
                        </button>
                        <button type="button" aria-label={`Supprimer : ${t.libelle}`} onClick={() => setConfirmId(t.id)} className="press grid size-9 place-items-center rounded-full border border-line-strong text-danger">
                          <Icon name="trash" size={15} />
                        </button>
                      </>
                    )}
                  </div>
                  </div>
                </div>
              ),
            )}
            {!p.transactions.length && (
              <p className="px-4 py-8 text-center text-sm text-muted">{filtrage ? "Aucune opération pour ces filtres." : "Aucune opération pour l'instant : ajoute la première dépense ou recette."}</p>
            )}
          </div>
        </section>

        <aside className="flex flex-[1_1_320px] flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
            <h2 className="flex items-center gap-2 text-[17px] font-extrabold">
              <Icon name="plus" stroke={2.6} /> Nouvelle opération
            </h2>
            <Formulaire key={cle} initial={null} aujourdhui={p.aujourdhui} categories={p.categories} evenements={p.evenements} uploads={p.uploads} onDone={done} />
          </section>

          {(p.resume.parCategorie.length > 0 || p.resume.parEvenement.length > 0) && (
            <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5 text-sm">
              {p.resume.parEvenement.length > 0 && (
                <>
                  <h2 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Par événement</h2>
                  {p.resume.parEvenement.map((e) => (
                    <div key={e.id} className="flex justify-between gap-3">
                      <span className="truncate">{e.titre}</span>
                      <b className={e.solde >= 0 ? "text-accent" : "text-coral"}>{dh(e.solde)}</b>
                    </div>
                  ))}
                </>
              )}
              {p.resume.parCategorie.length > 0 && (
                <>
                  <h2 className="mt-1 text-[13px] font-extrabold tracking-widest text-muted uppercase">Par catégorie</h2>
                  {p.resume.parCategorie.map((c) => (
                    <div key={c.categorie} className="flex justify-between gap-3">
                      <span>{c.categorie}</span>
                      <span className="text-muted">
                        {c.recettes > 0 && <b className="text-accent">+{dh(c.recettes)}</b>} {c.depenses > 0 && <b className="text-coral">−{dh(c.depenses)}</b>}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </section>
          )}
          <p className="text-[13px] leading-relaxed text-faint">
            Confidentiel : ni le coordinateur, ni l&apos;administrateur, ni les clubs partenaires n&apos;ont accès à ces données. Les justificatifs sont stockés en privé et ouverts par un lien valable 5 minutes.
          </p>
        </aside>
      </div>

      {toast && (
        <div role="status" className={`animate-toast fixed right-6 bottom-24 z-40 max-w-[calc(100%-48px)] rounded-[18px] px-4.5 py-3.5 text-sm font-extrabold shadow-2xl md:bottom-6 ${toast.ok ? "bg-paper text-ink" : "bg-danger text-ink"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
