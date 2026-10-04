import "server-only";
import { createHash } from "node:crypto";

// Envoi d'images direct du navigateur vers Cloudinary (le fichier ne passe pas par nos fonctions).
// Le serveur ne fait que signer : dossier choisi dans une liste fermée et formats image imposés.
export const UPLOAD_FOLDERS = ["ensate-clubs/affiches", "ensate-clubs/plannings", "ensate-clubs/logos"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

// Pas de SVG (peut contenir du script) : Cloudinary refuse tout format hors de cette liste signée.
const ALLOWED_FORMATS = "jpg,jpeg,png,webp,avif";

function config() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

export const uploadsEnabled = () => config() !== null;

/** Signature Cloudinary : paramètres triés « k=v » joints par « & », suivis du secret, en SHA-1. */
export function signUpload(folder: UploadFolder) {
  const c = config();
  if (!c) return null;
  const params = { allowed_formats: ALLOWED_FORMATS, folder, timestamp: Math.round(Date.now() / 1000) };
  const toSign = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const signature = createHash("sha1").update(toSign + c.apiSecret).digest("hex");
  return { cloudName: c.cloudName, apiKey: c.apiKey, signature, ...params };
}
