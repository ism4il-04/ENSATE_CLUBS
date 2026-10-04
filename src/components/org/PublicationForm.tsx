"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { enregistrerPublication } from "@/server/actions/publication";
import type { PublicationInput } from "@/server/services/publication";

type Tarif = { key: number; id?: string; libelle: string; prix: string; affiche: boolean };

export type PublicationInitial = {
  description: string;
  afficheUrl: string;
  capacite: number | null;
  placesMembres: number;
  gratuit: boolean;
  tarifs: { id: string; libelle: string; prix: number; affiche: boolean }[];
  ouvertExternes: boolean;
  telephoneRequis: boolean;
  modeInscription: "EN_LIGNE" | "STAND";
  inscriptionsOuvertes: boolean;
  listeAttenteActive: boolean;
};

const DEFAULT_TARIFS = [
  { libelle: "Adhérent", prix: "20", affiche: true },
  { libelle: "Non-adhérent", prix: "40", affiche: true },
  { libelle: "Bureau", prix: "0", affiche: false },
];

function Switch({ label, hint, on, disabled, onChange }: { label: string; hint: string; on: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <div className={`flex items-center justify-between gap-3.5 py-1 ${disabled ? "opacity-45" : ""}`}>
      <div className="flex flex-col gap-0.5">
        <span className="font-extrabold">{label}</span>
        <span className="text-[13px] text-muted">{hint}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on && !disabled}
        aria-label={label}
        disabled={disabled}
        onClick={onChange}
        className={`relative h-8 w-14 flex-none rounded-full transition-colors ${on && !disabled ? "bg-accent" : "bg-line"}`}
      >
        <span className={`absolute top-1 left-1 size-6 rounded-full transition-transform ${on && !disabled ? "translate-x-6 bg-ink" : "bg-muted"}`} />
      </button>
    </div>
  );
}

const field = "h-12.5 rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 font-bold outline-none focus:border-accent";

export function PublicationForm({
  eventId,
  slug,
  statut,
  isProgramme,
  titre,
  couleur,
  categorie,
  dateLabel,
  creneauxLabel,
  initial,
  activites,
}: {
  eventId: string;
  slug: string;
  statut: "VALIDE" | "PUBLIE";
  isProgramme: boolean;
  titre: string;
  couleur: string;
  categorie: string;
  dateLabel: string;
  creneauxLabel: string;
  initial: PublicationInitial;
  activites: { id: string; titre: string; statut: string }[];
}) {
  const keys = useMemo(() => ({ n: 100 }), []);
  const [desc, setDesc] = useState(initial.description);
  const [affiche, setAffiche] = useState(initial.afficheUrl);
  const [cap, setCap] = useState(initial.capacite === null ? "" : String(initial.capacite));
  const [membres, setMembres] = useState(initial.placesMembres);
  const [gratuit, setGratuit] = useState(initial.gratuit);
  const [tarifs, setTarifs] = useState<Tarif[]>(
    (initial.tarifs.length ? initial.tarifs.map((t) => ({ ...t, prix: String(t.prix) })) : DEFAULT_TARIFS).map((t, i) => ({ ...t, key: i + 1 })),
  );
  const [ext, setExt] = useState(initial.ouvertExternes);
  const [tel, setTel] = useState(initial.telephoneRequis);
  const [mode, setMode] = useState(initial.modeInscription);
  const [ouvertes, setOuvertes] = useState(statut === "VALIDE" ? true : initial.inscriptionsOuvertes);
  const [attente, setAttente] = useState(initial.listeAttenteActive);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<{ published: boolean; slug: string } | null>(null);
  const [pending, start] = useTransition();

  const capNum = cap === "" ? null : Math.max(1, parseInt(cap, 10) || 1);
  const shown = tarifs.filter((t) => t.affiche && t.libelle.trim());
  const minPrice = shown.length ? Math.min(...shown.map((t) => Number(t.prix) || 0)) : 0;
  const priceLabel = gratuit ? "Gratuit" : !shown.length ? "Tarif ?" : minPrice === 0 ? "Dès 0 DH" : `dès ${minPrice} DH`;
  const updT = (key: number, p: Partial<Tarif>) => setTarifs((all) => all.map((t) => (t.key === key ? { ...t, ...p } : t)));

  function submit(publish: boolean) {
    const input: PublicationInput = {
      description: desc,
      afficheUrl: affiche,
      capacite: capNum,
      placesMembres: Math.min(membres, capNum ?? membres),
      gratuit,
      tarifs: tarifs.map((t) => ({ id: t.id, libelle: t.libelle.trim(), prix: Math.max(0, Number(t.prix) || 0), affiche: t.affiche })),
      ouvertExternes: ext,
      telephoneRequis: tel,
      modeInscription: mode,
      inscriptionsOuvertes: ouvertes,
      listeAttenteActive: attente,
    };
    start(async () => {
      const r = await enregistrerPublication(eventId, input, publish);
      if (!r.ok) {
        setErrors(r.erreurs);
        setDone(null);
      } else {
        setErrors([]);
        setDone({ published: r.published, slug: r.slug });
      }
    });
  }

  const isPublished = statut === "PUBLIE" || done?.published;

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
        <div className="flex items-center gap-3.5 rounded-[22px] border border-line bg-surface p-4">
          <span className="grid size-10.5 flex-none place-items-center rounded-[13px] bg-surface-2 text-muted">
            <Icon name="lock" stroke={2.2} />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-extrabold">{creneauxLabel}</span>
            <span className="text-[13px] text-muted">Créneaux verrouillés après validation. Pour les changer, contacte le coordinateur des clubs.</span>
          </div>
        </div>

        <section className="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="desc" className="text-[17px] font-extrabold">
              Description <span className="text-danger">*</span>
            </label>
            <span className={`text-xs font-bold ${desc.trim().length >= 30 ? "text-accent" : "text-muted"}`}>{desc.trim().length} / 30 min.</span>
          </div>
          <textarea
            id="desc"
            rows={5}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Programme, intervenants, public visé, ce qu'il faut apporter…"
            className="resize-y rounded-2xl border-[1.5px] border-line-strong bg-ink px-4 py-3.5 leading-relaxed font-medium outline-none focus:border-accent"
          />
          <label className="mt-1 flex flex-col gap-1.5 text-[13px] font-bold text-muted">
            Affiche (lien https vers l&apos;image)
            <input value={affiche} onChange={(e) => setAffiche(e.target.value)} placeholder="https://…" className={field} />
            <span className="font-medium text-faint">L&apos;envoi direct d&apos;images arrive bientôt. Sans affiche, la couleur de l&apos;événement est utilisée.</span>
          </label>
        </section>

        {!isProgramme && (
          <>
            <section className="flex flex-col gap-3.5 rounded-3xl border border-line bg-surface p-5">
              <h2 className="text-[17px] font-extrabold">Tarifs</h2>
              <div role="group" aria-label="Type de tarif" className="grid grid-cols-2 gap-1 rounded-full border border-line bg-ink p-1">
                {(
                  [
                    [true, "Gratuit"],
                    [false, "Payant"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={gratuit === v}
                    onClick={() => setGratuit(v)}
                    className={`h-11 rounded-full text-sm font-extrabold ${gratuit === v ? "bg-accent text-ink" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {!gratuit && (
                <div className="animate-rise flex flex-col gap-2">
                  {tarifs.map((t) => (
                    <div key={t.key} className={`flex flex-wrap items-center gap-2 rounded-2xl border bg-ink p-2 ${t.affiche ? "border-line" : "border-line-strong"}`}>
                      <input
                        aria-label="Nom du tarif"
                        value={t.libelle}
                        onChange={(e) => updT(t.key, { libelle: e.target.value })}
                        placeholder="Nom du tarif"
                        className="h-11 min-w-0 flex-[1_1_160px] rounded-xl border-[1.5px] border-line-strong bg-surface px-3 font-bold outline-none focus:border-accent"
                      />
                      <span className="relative flex-[0_0_112px]">
                        <input
                          type="number"
                          min={0}
                          aria-label={`Prix du tarif ${t.libelle}`}
                          value={t.prix}
                          onChange={(e) => updT(t.key, { prix: e.target.value })}
                          className="h-11 w-full rounded-xl border-[1.5px] border-line-strong bg-surface pr-10 pl-3 font-bold outline-none focus:border-accent"
                        />
                        <span className="absolute top-3 right-3 font-extrabold text-faint">DH</span>
                      </span>
                      <button
                        type="button"
                        aria-pressed={t.affiche}
                        onClick={() => updT(t.key, { affiche: !t.affiche })}
                        className={`h-11 rounded-xl border px-3 text-xs font-extrabold ${t.affiche ? "border-accent bg-accent/12 text-accent" : "border-line-strong text-muted"}`}
                      >
                        {t.affiche ? "Affiché" : "Masqué"}
                      </button>
                      <button
                        type="button"
                        aria-label={`Supprimer le tarif ${t.libelle}`}
                        onClick={() => setTarifs((all) => all.filter((x) => x.key !== t.key))}
                        className="grid size-11 place-items-center rounded-xl border border-line-strong text-muted"
                      >
                        <Icon name="x" size={15} stroke={2.6} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTarifs((all) => [...all, { key: keys.n++, libelle: "", prix: "0", affiche: false }])}
                    className="press h-11.5 rounded-[14px] border-[1.5px] border-dashed border-line-strong text-sm font-extrabold"
                  >
                    + Ajouter un tarif (ex. : Bureau, Intervenant)
                  </button>
                  <span className="text-xs leading-relaxed text-faint">
                    « Masqué » : visible uniquement par les organisateurs. Le club choisit le tarif de chaque participant au moment d&apos;encaisser.
                  </span>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3.5 rounded-3xl border border-line bg-surface p-5">
              <h2 className="text-[17px] font-extrabold">Places</h2>
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
                Capacité totale (vide = illimitée)
                <input type="number" min={1} value={cap} onChange={(e) => setCap(e.target.value)} className={field} />
              </label>
              {capNum !== null && (
                <label className="flex flex-col gap-2.5 text-[13px] font-bold text-muted">
                  <span className="flex justify-between">
                    <span>Places réservées aux membres du club</span>
                    <span className="font-extrabold text-paper">{Math.min(membres, capNum)}</span>
                  </span>
                  <input type="range" min={0} max={capNum} value={Math.min(membres, capNum)} onChange={(e) => setMembres(parseInt(e.target.value, 10))} className="accent-accent" />
                  <span>
                    Places publiques : <b className="text-accent">{capNum - Math.min(membres, capNum)}</b>
                  </span>
                </label>
              )}
            </section>

            <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
              <h2 className="text-[17px] font-extrabold">Inscriptions</h2>
              <div role="group" aria-label="Mode d'inscription" className="grid grid-cols-2 gap-1 rounded-full border border-line bg-ink p-1">
                {(
                  [
                    ["EN_LIGNE", "En ligne + stand"],
                    ["STAND", "Stand uniquement"],
                  ] as const
                ).map(([v, label]) => (
                  <button key={v} type="button" aria-pressed={mode === v} onClick={() => setMode(v)} className={`h-11 rounded-full text-sm font-extrabold ${mode === v ? "bg-accent text-ink" : ""}`}>
                    {label}
                  </button>
                ))}
              </div>
              <Switch
                label="Inscriptions en ligne ouvertes"
                hint={mode === "EN_LIGNE" ? "Les étudiants peuvent s'inscrire depuis la plateforme." : "Indisponible en mode « stand uniquement »."}
                on={ouvertes}
                disabled={mode !== "EN_LIGNE"}
                onChange={() => setOuvertes(!ouvertes)}
              />
              <Switch label="Ouvert aux externes" hint="Personnes hors ENSA, connectées avec n'importe quel compte Google." on={ext} onChange={() => setExt(!ext)} />
              <Switch
                label="Liste d'attente"
                hint={gratuit ? "Les inscrits en attente sont promus automatiquement." : "Réservée aux événements gratuits."}
                on={attente}
                disabled={!gratuit}
                onChange={() => setAttente(!attente)}
              />
              <Switch label="Téléphone obligatoire" hint="Visible uniquement par les organisateurs de cet événement." on={tel} onChange={() => setTel(!tel)} />
            </section>
          </>
        )}

        {isProgramme && (
          <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
            <h2 className="text-[17px] font-extrabold">Activités du programme</h2>
            <p className="text-sm text-muted">Chaque activité a ses propres tarifs, places et mode d&apos;inscription.</p>
            {activites.map((a) => (
              <Link key={a.id} href={`/org/evenements/${a.id}/publication`} className="press flex items-center justify-between rounded-2xl border border-line bg-ink px-4 py-3 font-bold">
                {a.titre}
                <Icon name="chevronRight" className="text-muted" />
              </Link>
            ))}
            <Switch label="Ouvert aux externes" hint="Affiché sur la page du programme." on={ext} onChange={() => setExt(!ext)} />
          </section>
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
        {done && (
          <div role="status" className="animate-rise rounded-2xl bg-accent px-4 py-3.5 font-extrabold text-ink">
            {done.published ? "Enregistré : l'événement est visible par les étudiants." : "Enregistré."}
          </div>
        )}
        <div className="flex flex-wrap gap-2.5">
          {statut === "VALIDE" && !done?.published && (
            <button type="button" disabled={pending} onClick={() => submit(false)} className="press h-14 flex-[1_1_200px] rounded-full border border-line-strong font-extrabold">
              Enregistrer sans publier
            </button>
          )}
          <button type="button" disabled={pending} onClick={() => submit(!isPublished)} className="press h-14 flex-[1_1_220px] rounded-full bg-accent font-extrabold text-ink">
            {pending ? "Enregistrement…" : isPublished ? "Enregistrer les modifications" : "Publier l'événement"}
          </button>
          {isPublished && (
            <Link href={`/evenements/${slug}`} className="press flex h-14 flex-[1_1_200px] items-center justify-center rounded-full border border-line-strong font-extrabold">
              Voir la page publique
            </Link>
          )}
        </div>
      </div>

      <aside className="flex flex-[1_1_300px] flex-col gap-2.5">
        <span className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Aperçu</span>
        <article className="overflow-hidden rounded-[26px] border border-line bg-surface">
          <div className="relative flex h-[220px] flex-col justify-between overflow-hidden p-4.5 text-ink" style={{ background: couleur }}>
            {affiche.startsWith("https://") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={affiche} alt="" className="absolute inset-0 size-full object-cover" />
            )}
            <span className="relative self-start rounded-full bg-ink px-3 py-1.5 text-[11px] font-extrabold tracking-wider text-paper uppercase">{categorie}</span>
            <span className="relative font-display text-3xl leading-[0.88] font-extrabold tracking-tight uppercase">{titre}</span>
          </div>
          <div className="flex flex-col gap-2.5 p-4.5">
            <span className="text-sm text-muted">{dateLabel}</span>
            <p className="line-clamp-3 text-sm leading-relaxed text-muted">{desc.trim() || "La description apparaîtra ici."}</p>
            <div className="flex flex-wrap gap-1.5 text-[13px] font-bold">
              <span className="rounded-full border border-line-strong px-2.5 py-1 font-extrabold">{priceLabel}</span>
              {capNum !== null && <span className="rounded-full bg-surface-2 px-2.5 py-1">{capNum - Math.min(membres, capNum)} places</span>}
              <span className="rounded-full bg-surface-2 px-2.5 py-1">{mode === "STAND" ? "Au stand" : "En ligne"}</span>
              {ext && <span className="rounded-full bg-surface-2 px-2.5 py-1">Ouvert à tous</span>}
              {tel && <span className="rounded-full bg-surface-2 px-2.5 py-1">Téléphone requis</span>}
            </div>
          </div>
        </article>
      </aside>
    </div>
  );
}
