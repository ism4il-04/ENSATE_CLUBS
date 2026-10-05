import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { MESSAGES_CHECKIN } from "@/lib/erreurs";
import { api, ApiError, corps } from "@/server/api/http";
import { orgSurEvenement } from "@/server/api/serialiser";
import { getDb, schema as s } from "@/server/db";
import { checkin } from "@/server/services/checkin";

const Corps = z.object({ idCreneau: z.string().uuid(), tokenBillet: z.string().min(20).max(400).optional(), idInscription: z.string().uuid().optional() }).refine((b) => b.tokenBillet || b.idInscription, "tokenBillet ou idInscription requis.");

// Contrôle d'entrée (RG-19) : par scan du billet ou par recherche manuelle.
export const POST = api(
  async (req: Request) => {
    const b = await corps(req, Corps);
    const [c] = await getDb().select({ idEvenement: s.creneau.idEvenement }).from(s.creneau).where(and(eq(s.creneau.id, b.idCreneau))).limit(1);
    if (!c) throw new ApiError(404, "INTROUVABLE", "Créneau introuvable.");
    const { user } = await orgSurEvenement(c.idEvenement, "caisse");
    const r = await checkin({ eventId: c.idEvenement, creneauId: b.idCreneau, scannerId: user.id, token: b.tokenBillet?.trim().split("/").pop(), inscriptionId: b.idInscription });
    if (r.kind === "VALIDE") return { resultat: "VALIDE", participant: r.nom };
    if (r.kind === "DEJA_PRESENT") throw new ApiError(409, "DEJA_PRESENT", `${r.nom} : déjà scanné à ${r.a.toISOString()}.`);
    throw new ApiError(422, r.kind, "nom" in r ? `${r.nom} : ${MESSAGES_CHECKIN[r.kind]}` : MESSAGES_CHECKIN[r.kind]);
  },
  { status: 200 },
);
