import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { getDb, schema as s } from "@/server/db";

// QR dynamique du stand (RG-15) : jeton = HMAC(secret de session, fenêtre de 30 s).
const WINDOW_MS = 30_000;
const SESSION_MS = 8 * 3600 * 1000;
export const STAND_ACCESS_MS = 15 * 60 * 1000; // cookie « accès stand » (temps de se connecter)

const tokenFor = (secret: string, w: number) => createHmac("sha256", secret).update(String(w)).digest("base64url").slice(0, 16);

export async function ouvrirSession(p: { eventId: string; orgId: string; compteId: string }) {
  const db = getDb();
  const [evt] = await db.select({ statut: s.evenement.statut }).from(s.evenement).where(eq(s.evenement.id, p.eventId)).limit(1);
  if (evt?.statut !== "PUBLIE") return null; // pas de stand pour un événement non publié ou annulé
  await db
    .update(s.sessionStand)
    .set({ actif: false })
    .where(and(eq(s.sessionStand.idEvenement, p.eventId), eq(s.sessionStand.idOrganisation, p.orgId), eq(s.sessionStand.actif, true)));
  const [row] = await db
    .insert(s.sessionStand)
    .values({
      secret: randomBytes(32).toString("base64url"),
      dateExpiration: new Date(Date.now() + SESSION_MS),
      idEvenement: p.eventId,
      idOrganisation: p.orgId,
      idOuvreur: p.compteId,
    })
    .returning({ id: s.sessionStand.id });
  return row.id;
}

export async function fermerSession(sessionId: string, orgId: string) {
  await getDb()
    .update(s.sessionStand)
    .set({ actif: false })
    .where(and(eq(s.sessionStand.id, sessionId), eq(s.sessionStand.idOrganisation, orgId)));
}

export async function sessionActive(eventId: string, orgId: string) {
  const [row] = await getDb()
    .select({ id: s.sessionStand.id, dateExpiration: s.sessionStand.dateExpiration })
    .from(s.sessionStand)
    .where(
      and(
        eq(s.sessionStand.idEvenement, eventId),
        eq(s.sessionStand.idOrganisation, orgId),
        eq(s.sessionStand.actif, true),
        gt(s.sessionStand.dateExpiration, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function loadSession(sessionId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const [row] = await getDb().select().from(s.sessionStand).where(eq(s.sessionStand.id, sessionId)).limit(1);
  if (!row || !row.actif || row.dateExpiration.getTime() < Date.now()) return null;
  return row;
}

/** Jeton courant, pour l'écran du stand (le secret ne quitte jamais le serveur). */
export async function jetonCourant(sessionId: string, orgId: string) {
  const row = await loadSession(sessionId);
  if (!row || row.idOrganisation !== orgId) return null;
  const now = Date.now();
  const w = Math.floor(now / WINDOW_MS);
  return { token: tokenFor(row.secret, w), remainingMs: (w + 1) * WINDOW_MS - now };
}

/** Accepte la fenêtre courante et la précédente. */
export async function verifierJeton(sessionId: string, token: string) {
  const row = await loadSession(sessionId);
  if (!row || !token) return null;
  const w = Math.floor(Date.now() / WINDOW_MS);
  const ok = [w, w - 1].some((x) => {
    const expected = Buffer.from(tokenFor(row.secret, x));
    const got = Buffer.from(token);
    return expected.length === got.length && timingSafeEqual(expected, got);
  });
  return ok ? row : null;
}

// ---- cookie signé « accès stand »

function sign(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET manquant");
  return createHmac("sha256", secret).update(`stand-acces:${value}`).digest("base64url"); // préfixe : usage distinct du secret
}

export function standCookieName(sessionId: string) {
  return `stand_${sessionId.replace(/-/g, "").slice(0, 16)}`;
}

export function makeStandCookie(sessionId: string) {
  const exp = Date.now() + STAND_ACCESS_MS;
  return `${exp}.${sign(`${sessionId}.${exp}`)}`;
}

export function checkStandCookie(sessionId: string, value: string | undefined) {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = Buffer.from(sign(`${sessionId}.${exp}`));
  const got = Buffer.from(sig);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export async function sessionPourInscription(sessionId: string) {
  const row = await loadSession(sessionId);
  if (!row) return null;
  const db = getDb();
  const [evt] = await db.select().from(s.evenement).where(eq(s.evenement.id, row.idEvenement)).limit(1);
  const [org] = await db.select({ nom: s.organisation.nom, couleur: s.organisation.couleur }).from(s.organisation).where(eq(s.organisation.id, row.idOrganisation)).limit(1);
  return evt ? { session: row, evt, org } : null;
}
