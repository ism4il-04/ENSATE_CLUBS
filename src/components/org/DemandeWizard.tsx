"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { CATEGORIES, type CategorieKey } from "@/lib/format";
import { creerPourUnClub, enregistrerDemande, type DemandeResult } from "@/server/actions/demandes";

type Lieu = { id: string; code: string; nom: string; type: string; etage: number | null };
type Org = { id: string; nom: string; sigle: string | null; couleur: string };
type Slot = { key: number; titre: string; date: string; debut: string; fin: string; lieux: Record<string, boolean>; precision: string };

export type WizardInitial = {
  id?: string;
  structure: "SIMPLE" | "PROGRAMME";
  titre: string;
  categorie: CategorieKey;
  descriptionCourte: string;
  slots: Omit<Slot, "key">[];
  partenaires: string[];
  principal?: string;
};

const TIPS: Record<number, string[]> = {
  1: [
    "Un « programme » regroupe plusieurs activités, chacune avec sa date et sa propre inscription (ex. : une semaine culturelle).",
    "Les tarifs, les places et l'affiche se renseignent après la validation.",
  ],
  2: [
    "Tu peux choisir plusieurs lieux pour un même créneau, ou « Toute l'école ».",
    "Si l'heure de fin est avant l'heure de début, elle compte pour le lendemain (soirée).",
  ],
  3: ["Les partenaires voient l'événement, tiennent un stand, encaissent pour leur compte et font le contrôle d'entrée.", "Seule l'organisation principale modifie l'événement."],
  4: ["Vérifie les dates et les lieux : après validation, seul le coordinateur pourra les changer."],
};

export function DemandeWizard({
  mode,
  lieux,
  organisations,
  myOrgId,
  initial,
}: {
  mode: "org" | "coord";
  lieux: Lieu[];
  organisations: Org[];
  myOrgId?: string;
  initial?: WizardInitial;
}) {
  const coord = mode === "coord";
  const uid = useMemo(() => ({ n: 100 }), []);
  const [step, setStep] = useState(1);
  const [structure, setStructure] = useState<"SIMPLE" | "PROGRAMME">(initial?.structure ?? "SIMPLE");
  const [titre, setTitre] = useState(initial?.titre ?? "");
  const [cat, setCat] = useState<CategorieKey>(initial?.categorie ?? "CONFERENCE");
  const [desc, setDesc] = useState(initial?.descriptionCourte ?? "");
  const [principal, setPrincipal] = useState(initial?.principal ?? organisations[0]?.id ?? "");
  const [partners, setPartners] = useState<string[]>(initial?.partenaires ?? []);
  const [pq, setPq] = useState("");
  const [slots, setSlots] = useState<Slot[]>(
    initial?.slots.length
      ? initial.slots.map((x, i) => ({ ...x, key: i + 1 }))
      : [{ key: 1, titre: "", date: "", debut: "14:00", fin: "16:00", lieux: {}, precision: "" }],
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<DemandeResult | null>(null);
  const [pending, start] = useTransition();

  const prog = structure === "PROGRAMME";
  const word = prog ? "Activité" : "Créneau";
  const own = coord ? principal : myOrgId;
  const autre = lieux.find((l) => l.code === "AUTRE");
  const groups = [
    { label: "Rez-de-chaussée", items: lieux.filter((l) => l.type === "SALLE" && l.etage === 0) },
    { label: "1er étage", items: lieux.filter((l) => l.type === "SALLE" && l.etage === 1) },
    { label: "2e étage", items: lieux.filter((l) => l.type === "SALLE" && l.etage === 2) },
    { label: "Espaces", items: lieux.filter((l) => l.type !== "SALLE") },
  ].filter((g) => g.items.length);

  const upd = (key: number, patch: Partial<Slot>) => setSlots((all) => all.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  function localErrors(s: number) {
    const e: string[] = [];
    if (s === 1 && titre.trim().length < 3) e.push("Donne un titre à l'événement.");
    if (s === 2)
      slots.forEach((x, i) => {
        const n = `${word} ${i + 1}`;
        if (prog && !x.titre.trim()) e.push(`${n} : nom manquant.`);
        if (!x.date) e.push(`${n} : date manquante.`);
        if (!Object.values(x.lieux).some(Boolean)) e.push(`${n} : choisis au moins un lieu.`);
        if (autre && x.lieux[autre.id] && !x.precision.trim()) e.push(`${n} : précise le lieu « Autre ».`);
      });
    return e;
  }

  function payload() {
    const toCreneau = (x: Slot) => ({
      date: x.date,
      debut: x.debut,
      fin: x.fin,
      lieux: Object.keys(x.lieux)
        .filter((k) => x.lieux[k])
        .map((idLieu) => ({ idLieu, precision: idLieu === autre?.id ? x.precision : undefined })),
    });
    return {
      id: initial?.id,
      structure,
      titre,
      categorie: cat,
      descriptionCourte: desc,
      creneaux: prog ? [] : slots.map(toCreneau),
      activites: prog ? slots.map((x) => ({ titre: x.titre, creneau: toCreneau(x) })) : [],
      partenaires: partners,
      idOrganisationPrincipale: coord ? principal : undefined,
    };
  }

  function send(submit: boolean) {
    const errs = submit ? [...localErrors(1), ...localErrors(2)] : titre.trim().length < 3 ? ["Donne un titre pour enregistrer le brouillon."] : [];
    setErrors(errs);
    if (errs.length) return;
    start(async () => {
      const r = coord ? await creerPourUnClub(payload()) : await enregistrerDemande(payload(), submit);
      if (!r.ok) setErrors(r.erreurs);
      else setResult(r);
    });
  }

  const next = () => {
    const errs = localErrors(step);
    setErrors(errs);
    if (!errs.length) setStep(step + 1);
  };

  if (result?.ok) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[28px] border border-line bg-surface px-6 py-12 text-center">
        <span className="grid size-28 place-items-center rounded-full bg-accent text-ink">
          <Icon name="check" size={54} stroke={3} />
        </span>
        <h2 className="font-display text-4xl font-extrabold tracking-tight">
          {coord ? "Événement créé et validé" : result.submitted ? "Demande envoyée !" : "Brouillon enregistré"}
        </h2>
        <p className="max-w-[46ch] text-muted">
          {coord
            ? "L'organisation principale peut maintenant compléter l'affiche, les tarifs et les places, puis publier."
            : result.submitted
              ? "Le coordinateur des clubs va l'examiner. En attendant, la demande apparaît « En attente »."
              : "Tu peux la reprendre à tout moment depuis « Mes événements »."}
        </p>
        <Link href={coord ? "/coord" : "/org"} className="press flex h-12.5 items-center rounded-full bg-accent px-6 font-extrabold text-ink">
          {coord ? "Retour aux demandes" : "Voir mes événements"}
        </Link>
      </div>
    );
  }

  const labels = ["Type et infos", prog ? "Activités" : "Créneaux et lieux", "Partenaires", "Récapitulatif"];
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const suggestions = organisations.filter((o) => o.id !== own && !partners.includes(o.id) && (!pq || norm(o.nom).includes(norm(pq)))).slice(0, 6);
  const lieuName = (id: string, x: Slot) => (id === autre?.id ? `Autre : ${x.precision || "?"}` : (lieux.find((l) => l.id === id)?.nom ?? ""));

  return (
    <div className="flex flex-col gap-5">
      <ol aria-label="Étapes" className="grid grid-cols-4 gap-2">
        {labels.map((label, i) => {
          const n = i + 1;
          const done = step > n;
          const cur = step === n;
          return (
            <li key={label} className="flex flex-col gap-2">
              <div className={`h-1.5 rounded-full transition-colors ${done || cur ? "bg-accent" : "bg-line"}`} />
              <button
                type="button"
                disabled={n > step}
                onClick={() => setStep(n)}
                aria-current={cur ? "step" : undefined}
                className={`flex min-h-11 items-center gap-2 text-left text-sm font-bold ${cur ? "text-paper" : "text-muted"}`}
              >
                <span className={`grid size-6.5 flex-none place-items-center rounded-full text-xs font-extrabold ${done || cur ? "bg-accent text-ink" : "bg-surface-2"}`}>
                  {done ? "✓" : n}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-start gap-5">
        <section key={step} className="animate-rise flex min-w-0 flex-[999_1_520px] flex-col gap-5 rounded-[28px] border border-line bg-surface p-[clamp(18px,2.4vw,28px)]">
          {step === 1 && (
            <>
              {coord && (
                <div className="flex flex-col gap-2.5">
                  <span className="font-extrabold">Organisation principale</span>
                  <div className="flex flex-wrap gap-1.5">
                    {organisations.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={principal === o.id}
                        onClick={() => {
                          setPrincipal(o.id);
                          setPartners((p) => p.filter((x) => x !== o.id));
                        }}
                        className={`press flex h-11 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-sm font-bold ${principal === o.id ? "border-accent bg-surface-2" : "border-line bg-ink"}`}
                      >
                        <span className="grid size-8 place-items-center rounded-[10px] text-[11px] font-extrabold text-ink" style={{ background: o.couleur }}>
                          {o.sigle ?? o.nom.slice(0, 2)}
                        </span>
                        {o.nom}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2.5">
                <span className="font-extrabold">Type d&apos;événement</span>
                <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
                  {(
                    [
                      ["SIMPLE", "Événement simple", "Un ou plusieurs jours, une seule inscription pour tout l'événement."],
                      ["PROGRAMME", "Programme", "Plusieurs activités dans un grand événement, chacune avec sa propre inscription."],
                    ] as const
                  ).map(([k, t, d]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={structure === k}
                      onClick={() => setStructure(k)}
                      className={`press flex flex-col gap-1.5 rounded-[20px] border-2 p-4.5 text-left ${structure === k ? "border-accent bg-surface-2" : "border-line bg-ink"}`}
                    >
                      <span className="font-display text-[22px] font-extrabold">{t}</span>
                      <span className="text-sm leading-snug text-muted">{d}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-2 font-extrabold">
                Titre
                <input
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder="Ex. : Conférence cybersécurité"
                  className="h-13 rounded-2xl border-[1.5px] border-line-strong bg-ink px-4 text-[17px] font-semibold outline-none focus:border-accent"
                />
              </label>
              <div className="flex flex-col gap-2">
                <span className="font-extrabold">Catégorie</span>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(CATEGORIES) as CategorieKey[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={cat === k}
                      onClick={() => setCat(k)}
                      className={`press h-10.5 rounded-full border px-3.5 text-sm font-bold ${cat === k ? "border-accent bg-accent text-ink" : "border-line-strong bg-ink"}`}
                    >
                      {CATEGORIES[k]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-2 font-extrabold">
                <span>
                  Description courte <span className="font-semibold text-muted">(pour le coordinateur)</span>
                </span>
                <textarea
                  rows={3}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="En deux phrases : le contenu, le public, le besoin en salle."
                  className="resize-y rounded-2xl border-[1.5px] border-line-strong bg-ink px-4 py-3.5 font-medium leading-relaxed outline-none focus:border-accent"
                />
              </label>
            </>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3.5">
              {slots.map((x, i) => (
                <div key={x.key} className="flex flex-col gap-3.5 rounded-[22px] border border-line bg-ink p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xl font-extrabold">
                      {word} {i + 1}
                    </span>
                    {slots.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Supprimer ${word.toLowerCase()} ${i + 1}`}
                        onClick={() => setSlots((all) => all.filter((y) => y.key !== x.key))}
                        className="press grid size-10 place-items-center rounded-full border border-line-strong text-muted"
                      >
                        <Icon name="x" size={16} stroke={2.4} />
                      </button>
                    )}
                  </div>
                  {prog && (
                    <input
                      aria-label={`Nom de l'activité ${i + 1}`}
                      value={x.titre}
                      onChange={(e) => upd(x.key, { titre: e.target.value })}
                      placeholder="Nom de l'activité (ex. : Scène ouverte)"
                      className="h-12 rounded-[14px] border-[1.5px] border-line-strong bg-surface px-3.5 font-semibold outline-none focus:border-accent"
                    />
                  )}
                  <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
                    {(
                      [
                        ["date", "Date", "date"],
                        ["debut", "Début", "time"],
                        ["fin", "Fin", "time"],
                      ] as const
                    ).map(([k, label, type]) => (
                      <label key={k} className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
                        {label}
                        <input
                          type={type}
                          value={x[k]}
                          onChange={(e) => upd(x.key, { [k]: e.target.value })}
                          className="h-12 rounded-[14px] border-[1.5px] border-line-strong bg-surface px-3 font-semibold text-paper [color-scheme:dark] outline-none focus:border-accent"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[13px] font-bold text-muted">
                      Lieux <span className="font-semibold">(plusieurs possibles)</span>
                    </span>
                    {groups.map((g) => (
                      <div key={g.label} className="flex flex-wrap items-center gap-1.5">
                        <span className="w-[118px] text-xs font-extrabold tracking-wide text-faint">{g.label}</span>
                        {g.items.map((l) => {
                          const on = !!x.lieux[l.id];
                          return (
                            <button
                              key={l.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => upd(x.key, { lieux: { ...x.lieux, [l.id]: !on } })}
                              className={`h-10 min-w-13 rounded-xl border px-3 text-[13px] font-bold transition-colors active:scale-95 ${on ? "border-accent bg-accent text-ink" : "border-line bg-surface"}`}
                            >
                              {l.type === "SALLE" ? l.code : l.code === "AUTRE" ? "Autre…" : l.nom}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                    {autre && x.lieux[autre.id] && (
                      <input
                        aria-label="Préciser le lieu « Autre »"
                        value={x.precision}
                        onChange={(e) => upd(x.key, { precision: e.target.value })}
                        placeholder="Préciser le lieu (ex. : terrain de basket, hall)"
                        className="h-11.5 rounded-[14px] border-[1.5px] border-accent bg-surface px-3.5 font-semibold outline-none"
                      />
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const last = slots.at(-1);
                  setSlots((all) => [...all, { key: uid.n++, titre: "", date: last?.date ?? "", debut: last?.debut ?? "14:00", fin: last?.fin ?? "16:00", lieux: {}, precision: "" }]);
                }}
                className="press flex h-13 items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-line-strong font-extrabold"
              >
                + {prog ? "Ajouter une activité" : "Ajouter un créneau (autre jour)"}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <p className="leading-relaxed text-muted">
                Ajoute les organisations avec qui vous co-organisez. <b className="text-paper">L&apos;ajout est direct</b> : pas d&apos;invitation.
              </p>
              <div className="flex min-h-11 flex-wrap gap-2">
                {partners.map((id) => {
                  const o = organisations.find((x) => x.id === id);
                  if (!o) return null;
                  return (
                    <span key={id} className="flex h-11 items-center gap-2 rounded-full border border-accent bg-surface-2 px-1.5">
                      <span className="grid size-8 place-items-center rounded-[10px] text-[11px] font-extrabold text-ink" style={{ background: o.couleur }}>
                        {o.sigle ?? o.nom.slice(0, 2)}
                      </span>
                      <span className="text-sm font-bold">{o.nom}</span>
                      <button type="button" aria-label={`Retirer ${o.nom}`} onClick={() => setPartners((p) => p.filter((x) => x !== id))} className="grid size-8 place-items-center rounded-full text-muted">
                        <Icon name="x" size={14} stroke={2.6} />
                      </button>
                    </span>
                  );
                })}
                {!partners.length && <span className="self-center text-sm text-faint">Aucun partenaire (facultatif).</span>}
              </div>
              <label className="flex h-12.5 items-center gap-2 rounded-2xl border-[1.5px] border-line-strong bg-ink px-4 text-muted">
                <Icon name="search" />
                <span className="sr-only">Rechercher une organisation</span>
                <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Rechercher un club ou une association…" className="min-w-0 flex-1 bg-transparent font-semibold text-paper outline-none" />
              </label>
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))]">
                {suggestions.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setPartners((p) => [...p, o.id]);
                      setPq("");
                    }}
                    className="press flex items-center gap-2.5 rounded-2xl border border-line bg-ink p-2 pr-3 text-left text-sm font-bold"
                  >
                    <span className="grid size-8.5 flex-none place-items-center rounded-[11px] text-[11px] font-extrabold text-ink" style={{ background: o.couleur }}>
                      {o.sigle ?? o.nom.slice(0, 2)}
                    </span>
                    <span className="flex-1">{o.nom}</span>
                    <span className="font-extrabold text-accent">+ Ajouter</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-extrabold text-ink">
                  {prog ? `Programme · ${slots.length} activités` : `Événement simple · ${slots.length} créneau${slots.length > 1 ? "x" : ""}`}
                </span>
                <span className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-bold">{CATEGORIES[cat]}</span>
              </div>
              <h2 className="font-display text-[34px] leading-none font-extrabold tracking-tight">{titre || "Sans titre"}</h2>
              <span className="text-sm text-muted">
                {[organisations.find((o) => o.id === own)?.nom ?? "Ton organisation", ...partners.map((p) => organisations.find((o) => o.id === p)?.nom)].filter(Boolean).join(" + ")}
              </span>
              {slots.map((x) => (
                <div key={x.key} className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-line bg-ink px-3.5 py-3">
                  <span className="min-w-[140px] font-extrabold">
                    {x.date || "Date ?"} · {x.debut} – {x.fin}
                  </span>
                  {prog && <span className="text-sm text-soft">{x.titre || "Activité sans nom"}</span>}
                  <span className="ml-auto text-[13px] text-muted">
                    {Object.keys(x.lieux)
                      .filter((k) => x.lieux[k])
                      .map((k) => lieuName(k, x))
                      .join(", ") || "Aucun lieu"}
                  </span>
                </div>
              ))}
              <div className="rounded-2xl border border-sky/30 bg-sky/8 p-3.5 text-sm leading-relaxed text-soft">
                {coord
                  ? "L'événement sera créé directement « Validé ». L'organisation principale pourra le compléter et le publier."
                  : "Après envoi, la demande passe « En attente » et le coordinateur des clubs l'examine. Les créneaux seront verrouillés une fois validés."}
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div role="alert" className="flex flex-col gap-1.5 rounded-2xl border border-danger/45 bg-danger/10 px-4 py-3.5">
              {errors.map((e) => (
                <span key={e} className="text-sm font-bold text-danger">
                  • {e}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-2.5 border-t border-line pt-4">
            <button type="button" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className="press h-13 rounded-full border border-line-strong px-5.5 font-extrabold">
              Retour
            </button>
            <div className="flex flex-wrap gap-2">
              {!coord && (
                <button type="button" disabled={pending} onClick={() => send(false)} className="press h-13 rounded-full border border-line-strong px-5 font-extrabold">
                  Enregistrer le brouillon
                </button>
              )}
              {step < 4 ? (
                <button type="button" onClick={next} className="press flex h-13 items-center gap-2.5 rounded-full bg-accent px-6 font-extrabold text-ink">
                  Continuer <Icon name="arrowRight" stroke={2.6} />
                </button>
              ) : (
                <button type="button" disabled={pending} onClick={() => send(true)} className="press flex h-13 items-center gap-2.5 rounded-full bg-accent px-6 font-extrabold text-ink">
                  {pending ? "Envoi…" : coord ? "Créer l'événement (validé)" : "Envoyer au coordinateur"}
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="flex flex-[1_1_260px] flex-col gap-2.5 rounded-3xl border border-line bg-surface p-5">
          <span className="text-[13px] font-extrabold tracking-widest text-accent uppercase">Bon à savoir</span>
          {(TIPS[step] ?? []).map((t) => (
            <p key={t} className="text-sm leading-relaxed text-soft">
              {t}
            </p>
          ))}
        </aside>
      </div>
    </div>
  );
}
