import "server-only";
import { createHash } from "node:crypto";

// Envoi d'images direct du navigateur vers Cloudinary (le fichier ne passe pas par nos fonctions).
// Le serveur ne fait que signer : dossier choisi dans une liste fermée et formats image imposés.
export const UPLOAD_FOLDERS = ["ensate-clubs/affiches", "ensate-clubs/plannings", "ensate-clubs/logos"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

// Pas de SVG (peut contenir du script) : Cloudinary refuse tout format hors de cette liste signée.
const ALLOWED_FORMATS = "jpg,jpeg,png,webp,avif";
const JUSTIFICATIF_FORMATS = "jpg,jpeg,png,webp,pdf";

function config() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

export const uploadsEnabled = () => config() !== null;

/** Signature Cloudinary : paramètres triés « k=v » joints par « & », suivis du secret, en SHA-1. */
function sign(params: Record<string, string | number>, apiSecret: string) {
  const toSign = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

const now = () => Math.round(Date.now() / 1000);

export function signUpload(folder: UploadFolder) {
  const c = config();
  if (!c) return null;
  const params = { allowed_formats: ALLOWED_FORMATS, folder, timestamp: now() };
  return { cloudName: c.cloudName, apiKey: c.apiKey, signature: sign(params, c.apiSecret), ...params };
}

// ---- justificatifs de trésorerie (RG-21) : stockage « authenticated », jamais d'URL publique

export const dossierJustificatifs = (orgId: string) => `ensate-clubs/justificatifs/${orgId}`;

/** Signature d'envoi d'un justificatif dans le dossier privé de l'organisation. */
export function signJustificatif(orgId: string) {
  const c = config();
  if (!c) return null;
  const params = { allowed_formats: JUSTIFICATIF_FORMATS, folder: dossierJustificatifs(orgId), timestamp: now(), type: "authenticated" };
  return { cloudName: c.cloudName, apiKey: c.apiKey, signature: sign(params, c.apiSecret), ...params };
}

/** Lien de téléchargement signé, valable 5 minutes (API « download » de Cloudinary). */
export function lienJustificatif(publicId: string, format: string) {
  const c = config();
  if (!c) return null;
  const params = { expires_at: now() + 300, format, public_id: publicId, timestamp: now(), type: "authenticated" };
  const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: c.apiKey, signature: sign(params, c.apiSecret) });
  return `https://api.cloudinary.com/v1_1/${c.cloudName}/image/download?${q}`;
}

/** Suppression d'un justificatif (au mieux : un échec laisse un fichier privé orphelin, jamais public). */
export async function supprimerJustificatif(publicId: string) {
  const c = config();
  if (!c) return;
  const params = { public_id: publicId, timestamp: now(), type: "authenticated" };
  const body = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: c.apiKey, signature: sign(params, c.apiSecret) });
  await fetch(`https://api.cloudinary.com/v1_1/${c.cloudName}/image/destroy`, { method: "POST", body }).catch((e) => console.error("[cloudinary] suppression impossible", e));
}
