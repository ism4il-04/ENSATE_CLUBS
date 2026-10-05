import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { MESSAGES_CAISSE, MESSAGES_INSCRIPTION } from "@/lib/erreurs";
import { AccessError } from "@/server/permissions";
import { CaisseError } from "@/server/services/caisse";
import { InscriptionError } from "@/server/services/inscriptions";

// Socle de l'API REST /api/v1 (contrat : docs/07_API.md).
// - Authentification : le cookie de session (même origine : PWA, ou WebView d'une future application).
// - CSRF : toute requête qui modifie des données doit envoyer du JSON et venir de la même origine.
// - Erreurs : { "erreur": { "code", "message", "champs"? } }.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public champs?: Record<string, string>,
  ) {
    super(message);
  }
}

const MESSAGES_HTTP: Record<string, string> = {
  NON_AUTHENTIFIE: "Connecte-toi pour continuer.",
  ACCES_REFUSE: "Accès refusé.",
  INTROUVABLE: "Introuvable.",
};

function erreur(status: number, code: string, message: string, champs?: Record<string, string>) {
  return NextResponse.json({ erreur: { code, message, ...(champs ? { champs } : {}) } }, { status, headers: { "Cache-Control": "no-store" } });
}

function versReponse(e: unknown) {
  if (e instanceof ApiError) return erreur(e.status, e.code, e.message, e.champs);
  if (e instanceof AccessError) return erreur(e.code === "NON_AUTHENTIFIE" ? 401 : e.code === "INTROUVABLE" ? 404 : 403, e.code, MESSAGES_HTTP[e.code]);
  if (e instanceof InscriptionError) {
    const status = e.code === "DEJA_INSCRIT" ? 409 : e.code === "INTROUVABLE" ? 404 : e.code === "ACCES_REFUSE" || e.code === "RESERVE_ETUDIANTS_ENSA" ? 403 : 422;
    return erreur(status, e.code, MESSAGES_INSCRIPTION[e.code] ?? e.code);
  }
  if (e instanceof CaisseError) {
    const status = e.code === "DEJA_INSCRIT" ? 409 : e.code === "INTROUVABLE" ? 404 : 422;
    return erreur(status, e.code, MESSAGES_CAISSE[e.code] ?? e.code);
  }
  if (e instanceof ZodError) {
    const champs = Object.fromEntries(e.issues.map((i) => [i.path.join(".") || "_", i.message]));
    return erreur(422, "VALIDATION", "Données invalides.", champs);
  }
  console.error("[api]", e);
  return erreur(500, "ERREUR", "Une erreur est survenue.");
}

/** Refuse les écritures qui ne viennent pas de la même origine ou qui ne sont pas du JSON (défense CSRF). */
function verifierEcriture(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) throw new ApiError(403, "ORIGINE_REFUSEE", "Requête d'une autre origine refusée.");
  const hasBody = req.method !== "DELETE" || Number(req.headers.get("content-length") ?? 0) > 0;
  if (hasBody && !(req.headers.get("content-type") ?? "").includes("application/json")) {
    throw new ApiError(415, "JSON_REQUIS", "Envoie un corps JSON (Content-Type: application/json).");
  }
}

type Options = { public?: boolean; status?: number };

/** Enveloppe une route : vérifications communes, sérialisation JSON et conversion des erreurs. */
export function api<C>(handler: (req: Request, ctx: C) => Promise<unknown>, opts: Options = {}) {
  return async (req: Request, ctx: C) => {
    try {
      verifierEcriture(req);
      const data = await handler(req, ctx);
      if (data instanceof Response) return data;
      return NextResponse.json(data ?? { ok: true }, {
        status: opts.status ?? (req.method === "POST" ? 201 : 200),
        headers: { "Cache-Control": opts.public ? "public, max-age=60, stale-while-revalidate=300" : "no-store" },
      });
    } catch (e) {
      return versReponse(e);
    }
  };
}

/** Corps JSON validé par un schéma (422 VALIDATION sinon). */
export async function corps<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const raw = await req.json().catch(() => {
    throw new ApiError(400, "JSON_INVALIDE", "Le corps de la requête n'est pas du JSON valide.");
  });
  return schema.parse(raw);
}

export const uuid = (v: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(v)) throw new ApiError(404, "INTROUVABLE", "Introuvable.");
  return v;
};

export const montant = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v).toFixed(2));

/** Pagination `?page=1&taille=20` (taille max 100). */
export function paginer<T>(req: Request, items: T[]) {
  const q = new URL(req.url).searchParams;
  const taille = Math.min(100, Math.max(1, Number(q.get("taille")) || 20));
  const page = Math.max(1, Number(q.get("page")) || 1);
  return { donnees: items.slice((page - 1) * taille, page * taille), page, taille, total: items.length };
}
