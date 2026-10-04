import type { Metadata } from "next";
import { imageUrl } from "@/lib/images";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InscriptionPanel } from "@/components/events/InscriptionPanel";
import { placesInfo, priceText } from "@/components/events/EventCard";
import { Icon } from "@/components/ui/Icon";
import { CATEGORIES, dateStamp, dayLabel, priceLabel, rangeLabel, timeLabel, type CategorieKey } from "@/lib/format";
import { getSessionUser } from "@/server/permissions";
import { getPublicEvent } from "@/server/queries/evenements";
import { getMyInscription, getPersonne } from "@/server/queries/moi";

export async function generateMetadata({ params }: PageProps<"/evenements/[slug]">): Promise<Metadata> {
  const e = await getPublicEvent((await params).slug);
  return e ? { title: e.titre, description: e.descriptionCourte ?? undefined } : { title: "Événement introuvable" };
}

export default async function EvenementPage({ params }: PageProps<"/evenements/[slug]">) {
  const e = await getPublicEvent((await params).slug);
  if (!e) notFound();

  const user = await getSessionUser();
  const [mine, personne] = user ? await Promise.all([getMyInscription(user.id, e.id), getPersonne(user.id)]) : [null, null];
  const places = placesInfo(e);
  const isProgramme = e.structure === "PROGRAMME";
  const principal = e.orgs.find((o) => o.role === "PRINCIPAL");
  const plannings = e.medias.filter((m) => m.type === "PLANNING");

  return (
    <article className="flex flex-col gap-8">
      <Link href="/" className="flex min-h-11 items-center gap-1.5 self-start text-sm font-bold text-muted">
        <Icon name="chevronLeft" stroke={2.4} /> Tous les événements
      </Link>

      <section className="grid items-start gap-7 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
        <div
          className="animate-rise relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-[34px] p-6 text-ink"
          style={{ background: e.couleur }}
        >
          {e.afficheUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl(e.afficheUrl, 1200)} alt={`Affiche : ${e.titre}`} className="absolute inset-0 size-full object-cover" />
          )}
          <span aria-hidden className="absolute -right-16 bottom-8 size-56 rotate-12 rounded-[64px] bg-white/20" />
          <div className="relative flex flex-wrap gap-2">
            <span className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-extrabold tracking-wider text-paper uppercase">
              {isProgramme ? `Programme · ${e.sousEvenements.length} activités` : CATEGORIES[e.categorie as CategorieKey]}
            </span>
            {e.ouvertExternes && <span className="rounded-full bg-ink/15 px-3 py-1.5 text-[11px] font-extrabold uppercase">Ouvert à tous</span>}
          </div>
          <span className="relative font-display text-[clamp(52px,7vw,96px)] leading-[0.82] font-extrabold tracking-[-0.055em] uppercase">
            {e.titre}
          </span>
        </div>

        <div className="flex flex-col gap-5">
          <h1 className="font-display text-[clamp(32px,4vw,48px)] leading-none font-extrabold tracking-[-0.04em]">{e.titre}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            Organisé par
            {e.orgs.map((o) => (
              <Link key={o.id} href={`/clubs/${o.slug}`} className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface pr-3 pl-1 font-bold text-paper">
                <span className="grid size-7 place-items-center rounded-lg text-[11px] font-extrabold text-ink" style={{ background: o.couleur }}>
                  {o.sigle ?? o.nom.slice(0, 2)}
                </span>
                {o.nom}
              </Link>
            ))}
          </div>

          {!isProgramme && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Prix", priceText(e)],
                  ["Places", places.label.replace(" restantes", "").replace("Places illimitées", "Illimitées")],
                  ["Inscription", e.modeInscription === "STAND" ? "Au stand" : e.modeInscription === "AUCUNE" ? "Libre" : "En ligne"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-[20px] border border-line bg-surface p-3.5">
                    <div className="text-xs font-semibold text-muted">{k}</div>
                    <div className="mt-1.5 font-display text-lg leading-tight font-extrabold">{v}</div>
                  </div>
                ))}
              </div>
              <InscriptionPanel
                event={{
                  id: e.id,
                  slug: e.slug,
                  gratuit: e.gratuit,
                  mode: e.modeInscription,
                  ouvertes: e.inscriptionsOuvertes,
                  telephoneRequis: e.telephoneRequis,
                  ouvertExternes: e.ouvertExternes,
                  complet: e.restantes === 0,
                  listeAttente: e.listeAttenteActive,
                  prix: priceText(e),
                }}
                user={user ? { role: user.role, hasPhone: !!personne?.telephone } : null}
                existing={mine ? { id: mine.id, statut: mine.statut, paye: !!mine.datePaiement } : null}
              />
            </>
          )}
        </div>
      </section>

      {isProgramme && (
        <section className="flex flex-col gap-3.5">
          <h2 className="font-display text-4xl font-extrabold tracking-tight">Les activités</h2>
          <p className="text-muted">Une inscription par activité : chacune a ses tarifs, ses places et son mode d&apos;inscription.</p>
          {e.sousEvenements.map((a) => {
            const st = a.debut ? dateStamp(a.debut) : null;
            return (
              <Link key={a.id} href={`/evenements/${a.slug}`} className="lift flex flex-wrap items-center gap-4.5 rounded-[26px] border border-line bg-surface p-4">
                <span className="flex size-24 flex-none flex-col items-center justify-center rounded-[22px] leading-none text-ink" style={{ background: a.couleur }}>
                  <span className="text-xs font-extrabold tracking-widest">{st?.dow}</span>
                  <span className="mt-1 font-display text-[40px] font-extrabold">{st?.day}</span>
                </span>
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
                  <h3 className="text-xl font-extrabold">{a.titre}</h3>
                  <span className="text-sm text-muted">
                    {a.debut && a.fin ? `${timeLabel(a.debut)} – ${timeLabel(a.fin)}` : ""} · {a.lieux.join(", ")}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-line-strong px-2.5 py-1 text-[13px] font-extrabold">{priceText(a)}</span>
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[13px] font-bold">{placesInfo(a).label}</span>
                  </span>
                </div>
                <Icon name="chevronRight" size={22} className="text-muted" />
              </Link>
            );
          })}
        </section>
      )}

      {!isProgramme && (
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
          <section className="flex flex-col gap-3.5">
            <h2 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Créneaux</h2>
            {e.creneaux.map((c, i) => (
              <div key={c.id} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span className={`mt-1 size-3.5 rounded-full ${i === 0 ? "bg-accent" : "border-[3px] border-accent"}`} />
                  {i < e.creneaux.length - 1 && <span className="my-1.5 w-0.5 flex-1 bg-line" />}
                </div>
                <div className="flex flex-col gap-1.5 pb-5">
                  <span className="text-xs font-extrabold tracking-wider text-muted uppercase">
                    {c.libelle ?? `Jour ${i + 1}`} · {dayLabel(c.debut)}
                  </span>
                  <span className="font-display text-[22px] font-bold">
                    {timeLabel(c.debut)} → {timeLabel(c.fin)}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {c.lieux.map((l) => (
                      <span key={l} className="rounded-full bg-surface-2 px-2.5 py-1 text-[13px] font-semibold">
                        {l}
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-3.5">
            {!e.gratuit && e.tarifs.length > 0 && (
              <>
                <h2 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Tarifs</h2>
                {e.tarifs.map((t) => (
                  <div key={t.libelle} className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
                    <span className="font-extrabold">{t.libelle}</span>
                    <span className="font-display text-xl font-extrabold">{priceLabel(t.prix)}</span>
                  </div>
                ))}
                <span className="text-[13px] text-muted">Le club choisit ton tarif au moment du paiement.</span>
              </>
            )}
            {e.placesPubliques !== null && (
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between text-sm">
                  <span className="font-bold">
                    {e.confirmes} / {e.placesPubliques} places publiques prises
                  </span>
                  <span className="text-muted">{places.pct} %</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${places.pct}%` }} />
                </div>
                {e.placesMembres > 0 && <span className="text-[13px] text-muted">+ {e.placesMembres} places réservées aux membres des clubs organisateurs.</span>}
              </div>
            )}
          </section>
        </div>
      )}

      {(e.description || e.descriptionCourte) && (
        <section className="flex max-w-3xl flex-col gap-2.5">
          <h2 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">À propos</h2>
          <p className="leading-relaxed whitespace-pre-line text-soft">{e.description ?? e.descriptionCourte}</p>
        </section>
      )}

      {plannings.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Planning</h2>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
            {plannings.map((m) => (
              <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="lift block" aria-label={`${m.texteAlternatif ?? "Planning"} (plein écran)`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(m.url, 1000)} alt={m.texteAlternatif ?? "Planning"} loading="lazy" className="w-full rounded-[22px] border border-line" />
              </a>
            ))}
          </div>
        </section>
      )}

      {principal && (principal.emailContact || principal.instagram) && (
        <p className="text-[13px] text-faint">
          Contact {principal.nom} : {[principal.emailContact, principal.instagram].filter(Boolean).join(" · ")}
          {e.debut && e.fin ? ` — ${rangeLabel(e.debut, e.fin)}` : ""}
        </p>
      )}
    </article>
  );
}
