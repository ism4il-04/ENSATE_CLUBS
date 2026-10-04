import Link from "next/link";
import { imageUrl } from "@/lib/images";
import { Icon } from "@/components/ui/Icon";
import { CATEGORIES, dateStamp, rangeLabel, type CategorieKey } from "@/lib/format";
import type { EventCard as EventCardData } from "@/server/queries/evenements";

/** Taille du titre sur l'affiche : le mot le plus long doit tenir à côté de la date. */
function posterSize(titre: string) {
  const longest = Math.max(...titre.split(/\s+/).map((w) => w.length));
  return longest > 10 ? "text-[20px]" : longest > 8 || titre.length > 16 ? "text-[24px]" : "text-3xl";
}

export function priceText(e: Pick<EventCardData, "gratuit" | "prixMin" | "tarifs">) {
  if (e.gratuit) return "Gratuit";
  if (!e.tarifs.length) return "Tarif au stand";
  return e.prixMin === 0 ? "Dès 0 DH" : `dès ${e.prixMin} DH`;
}

export function placesInfo(e: Pick<EventCardData, "restantes" | "placesPubliques">) {
  if (e.restantes === null || e.placesPubliques === null) return { label: "Places illimitées", tone: "muted" as const, pct: 0 };
  const pct = e.placesPubliques ? Math.round(((e.placesPubliques - e.restantes) / e.placesPubliques) * 100) : 100;
  if (e.restantes === 0) return { label: "Complet", tone: "danger" as const, pct: 100 };
  if (e.restantes / Math.max(1, e.placesPubliques) < 0.15) return { label: `Plus que ${e.restantes} places`, tone: "amber" as const, pct };
  return { label: `${e.restantes} places restantes`, tone: "muted" as const, pct };
}

const TONE = { muted: "text-muted", amber: "text-amber", danger: "text-danger" };
const BAR = { muted: "bg-accent", amber: "bg-amber", danger: "bg-danger" };

export function EventCard({ e, index = 0 }: { e: EventCardData; index?: number }) {
  const stamp = e.debut ? dateStamp(e.debut) : null;
  const places = placesInfo(e);
  return (
    <article
      className="lift animate-rise flex flex-col overflow-hidden rounded-[26px] border border-line bg-surface"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <Link href={`/evenements/${e.slug}`} className="flex flex-1 flex-col">
        <div className="group relative flex h-[212px] flex-col justify-between overflow-hidden p-4.5 text-ink" style={{ background: e.couleur }}>
          {e.afficheUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl(e.afficheUrl, 640)} alt="" className="absolute inset-0 size-full object-cover" />
          )}
          <span aria-hidden className="absolute -top-12 -right-12 size-44 rounded-full border-[22px] border-ink/10" />
          <div className="relative flex flex-wrap gap-1.5">
            <span className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-extrabold tracking-wider text-paper uppercase">
              {CATEGORIES[e.categorie as CategorieKey]}
            </span>
            {e.ouvertExternes && (
              <span className="rounded-full bg-ink/15 px-2.5 py-1.5 text-[11px] font-extrabold tracking-wide uppercase">Ouvert à tous</span>
            )}
          </div>
          <div className="relative flex items-end justify-between gap-3">
            <span className={`min-w-0 font-display leading-[0.88] font-extrabold tracking-tight hyphens-auto uppercase ${posterSize(e.titre)}`}>{e.titre}</span>
            {stamp && (
              <span className="flex min-w-14 flex-none flex-col items-center rounded-2xl bg-ink px-1.5 py-2 leading-none text-paper">
                <span className="text-[11px] font-extrabold tracking-widest text-muted">{stamp.dow}</span>
                <span className="mt-1 mb-0.5 font-display text-[26px] font-extrabold">{stamp.day}</span>
                <span className="text-[11px] font-extrabold tracking-widest">{stamp.mon}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4.5">
          <h3 className="text-lg leading-tight font-extrabold">{e.titre}</h3>
          <div className="flex flex-col gap-1.5 text-sm text-muted">
            {e.debut && e.fin && (
              <span className="flex items-center gap-2">
                <Icon name="clock" size={15} />
                {rangeLabel(e.debut, e.fin)}
              </span>
            )}
            {e.lieux.length > 0 && (
              <span className="flex items-center gap-2">
                <Icon name="pin" size={15} />
                {e.lieux.join(" · ")}
              </span>
            )}
            <span className="flex items-center gap-2">
              <Icon name="users" size={15} />
              {e.orgs.map((o) => o.nom).join(" × ")}
            </span>
          </div>
          <div className="mt-auto flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full border border-line-strong px-3 py-1.5 text-sm font-extrabold">{priceText(e)}</span>
              <span className={`text-[13px] font-bold ${TONE[places.tone]}`}>{places.label}</span>
            </div>
            {e.placesPubliques !== null && (
              <div role="progressbar" aria-label="Places prises" aria-valuenow={places.pct} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-line">
                <div className={`h-full rounded-full ${BAR[places.tone]}`} style={{ width: `${places.pct}%` }} />
              </div>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
