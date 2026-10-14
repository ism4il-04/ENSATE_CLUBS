// Vérifie la configuration Cloudinary : envoi signé d'une image d'essai, lecture, puis suppression.
// Usage : node scripts/verifier-cloudinary.mjs [--env .env.prod.local]
// N'affiche jamais les clés.
import { createHash } from "node:crypto";
import { config } from "dotenv";

const args = process.argv.slice(2);
const envFile = args.includes("--env") ? args[args.indexOf("--env") + 1] : ".env.local";
config({ path: envFile, quiet: true });

const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
const manquantes = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].filter((k) => !process.env[k]);
if (manquantes.length) {
  console.log(`✗ Variables manquantes dans ${envFile} : ${manquantes.join(", ")}`);
  process.exit(1);
}

const signe = (params) =>
  createHash("sha1")
    .update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&") + secret)
    .digest("hex");
const maintenant = () => Math.round(Date.now() / 1000);

// Image d'essai : carré 2×2 px (PNG).
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4GBgYGJgYGBAQAa3gH/0F3+mQAAAABJRU5ErkJggg==";

console.log(`Compte Cloudinary : ${cloud} (${envFile})`);
const params = { allowed_formats: "jpg,jpeg,png,webp,avif", folder: "ensate-clubs/affiches", timestamp: maintenant() };
const form = new FormData();
form.append("file", `data:image/png;base64,${PNG}`);
for (const [k, v] of Object.entries(params)) form.append(k, String(v));
form.append("api_key", key);
form.append("signature", signe(params));
const up = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body: form });
const res = await up.json();
if (!up.ok) {
  console.log(`✗ Envoi refusé (${up.status}) : ${res?.error?.message ?? "erreur inconnue"}`);
  process.exit(1);
}
console.log(`✓ Envoi signé accepté : ${res.public_id}`);

const lu = await fetch(res.secure_url);
console.log(lu.ok ? "✓ Image servie par Cloudinary" : `✗ Image non servie (${lu.status})`);

const d = { public_id: res.public_id, timestamp: maintenant() };
const del = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
  method: "POST",
  body: new URLSearchParams({ ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v)])), api_key: key, signature: signe(d) }),
});
console.log((await del.json()).result === "ok" ? "✓ Image d'essai supprimée" : "! Image d'essai non supprimée (à retirer à la main)");
