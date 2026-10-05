import { api, paginer } from "@/server/api/http";
import { evenementResume } from "@/server/api/serialiser";
import { listPublishedEvents } from "@/server/queries/evenements";

// 🌐 Événements publiés à venir. Filtres : categorie, organisation (slug), gratuit, du, au (AAAA-MM-JJ).
export const GET = api(
  async (req: Request) => {
    const q = new URL(req.url).searchParams;
    const du = q.get("du"), au = q.get("au"), cat = q.get("categorie"), org = q.get("organisation"), gratuit = q.get("gratuit");
    const list = (await listPublishedEvents()).filter(
      (e) =>
        (!cat || e.categorie === cat) &&
        (!org || e.orgs.some((o) => o.slug === org)) &&
        (gratuit === null || e.gratuit === (gratuit === "true" || gratuit === "1")) &&
        (!du || (e.fin ? e.fin.toISOString().slice(0, 10) >= du : true)) &&
        (!au || (e.debut ? e.debut.toISOString().slice(0, 10) <= au : true)),
    );
    return paginer(req, list.map(evenementResume));
  },
  { public: true },
);
