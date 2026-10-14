"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { imageUrl } from "@/lib/images";

type Folder = "ensate-clubs/affiches" | "ensate-clubs/plannings" | "ensate-clubs/logos";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_BYTES = 10 * 1024 * 1024; // limite du plan gratuit Cloudinary

const ERREURS: Record<string, string> = {
  NON_AUTHENTIFIE: "Session expirée : reconnecte-toi.",
  ACCES_REFUSE: "Ton compte ne peut pas envoyer d'images.",
  ENVOI_NON_CONFIGURE: "L'envoi d'images n'est pas encore configuré : colle un lien.",
};

/** Signe l'envoi auprès de notre serveur puis envoie le fichier directement à Cloudinary. */
async function uploadImage(file: File, folder: Folder): Promise<string> {
  if (!ACCEPT.split(",").includes(file.type)) throw new Error("Formats acceptés : JPG, PNG, WebP ou AVIF.");
  if (file.size > MAX_BYTES) throw new Error("Image trop lourde (10 Mo maximum).");

  const res = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder }) });
  const signed = await res.json().catch(() => null);
  if (!res.ok) throw new Error(ERREURS[signed?.erreur] ?? "Impossible de préparer l'envoi.");

  const body = new FormData();
  body.append("file", file);
  body.append("api_key", signed.apiKey);
  body.append("timestamp", String(signed.timestamp));
  body.append("signature", signed.signature);
  body.append("folder", signed.folder);
  body.append("allowed_formats", signed.allowed_formats);
  const up = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, { method: "POST", body });
  const result = await up.json().catch(() => null);
  if (!up.ok || typeof result?.secure_url !== "string") throw new Error(result?.error?.message ?? "L'image a été refusée.");
  return result.secure_url;
}

function useUploader(folder: Folder) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  async function run(files: File[], onDone: (urls: string[]) => void) {
    setBusy(true);
    setError(null);
    const urls: string[] = [];
    try {
      for (const f of files) urls.push(await uploadImage(f, folder));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'envoi.");
    } finally {
      if (urls.length) onDone(urls);
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return { busy, error, setError, ref, run };
}

function PickButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="press flex h-11 items-center gap-2 rounded-full border-[1.5px] border-line-strong bg-ink px-4 text-sm font-extrabold text-paper disabled:opacity-60"
    >
      <Icon name="upload" stroke={2.2} />
      {busy ? "Envoi…" : label}
    </button>
  );
}

/** Une image (affiche, logo) : envoi direct si Cloudinary est configuré, sinon lien https. */
export function ImageUpload({
  folder,
  enabled,
  value,
  onChange,
  defaut,
  name,
  label,
  hint,
}: {
  folder: Folder;
  enabled: boolean;
  value: string;
  onChange: (url: string) => void;
  /** Image proposée par la plateforme (logo par défaut) : « Retirer » y ramène. */
  defaut?: string | null;
  name?: string;
  label: string;
  hint?: string;
}) {
  const { busy, error, ref, run } = useUploader(folder);

  return (
    <div className="flex flex-col gap-2 text-[13px] font-bold text-muted">
      <span>{label}</span>
      {name && <input type="hidden" name={name} value={value} />}
      <div className="flex flex-wrap items-center gap-3">
        {/^(https:\/\/|\/logos\/)/.test(value) ? (
          // Aperçu : image envoyée sur Cloudinary ou logo par défaut du site (/logos/…).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl(value, 240)} alt="" className="h-20 w-auto max-w-40 rounded-xl border border-line object-cover" />
        ) : (
          <span className="grid h-20 w-16 place-items-center rounded-xl border border-dashed border-line-strong text-faint">
            <Icon name="image" stroke={2} />
          </span>
        )}
        {enabled && (
          <>
            <input ref={ref} type="file" accept={ACCEPT} className="hidden" onChange={(e) => e.target.files?.[0] && run([e.target.files[0]], ([u]) => onChange(u))} />
            <PickButton label={value ? "Remplacer" : "Choisir une image"} busy={busy} onClick={() => ref.current?.click()} />
          </>
        )}
        {!enabled && <span className="font-medium text-faint">L&apos;envoi d&apos;images n&apos;est pas encore activé sur la plateforme.</span>}
        {value && !busy && value !== defaut && (
          <button type="button" onClick={() => onChange(defaut ?? "")} className="press flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-muted hover:text-danger">
            <Icon name="trash" stroke={2.2} /> {defaut ? "Revenir au logo par défaut" : "Retirer"}
          </button>
        )}
      </div>
      {error && (
        <span role="alert" className="text-danger">
          {error}
        </span>
      )}
      {hint && <span className="font-medium text-faint">{hint}</span>}
    </div>
  );
}

/** Plusieurs images (photos du planning). */
export function ImageListUpload({
  folder,
  enabled,
  value,
  onChange,
  max,
  label,
  hint,
}: {
  folder: Folder;
  enabled: boolean;
  value: string[];
  onChange: (urls: string[]) => void;
  max: number;
  label: string;
  hint?: string;
}) {
  const { busy, error, ref, run } = useUploader(folder);
  const room = max - value.length;

  return (
    <div className="flex flex-col gap-2 text-[13px] font-bold text-muted">
      <span>
        {label} <span className="font-semibold text-faint">({value.length} / {max})</span>
      </span>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2.5">
          {value.map((u, i) => (
            <li key={u + i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(u, 240)} alt={`Planning ${i + 1}`} className="h-24 w-auto max-w-44 rounded-xl border border-line object-cover" />
              <button
                type="button"
                aria-label={`Retirer l'image ${i + 1}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="press absolute -top-2 -right-2 grid size-8 place-items-center rounded-full border border-line-strong bg-ink text-paper"
              >
                <Icon name="x" size={14} stroke={2.6} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {room > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          {enabled && (
            <>
              <input
                ref={ref}
                type="file"
                accept={ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => e.target.files?.length && run(Array.from(e.target.files).slice(0, room), (urls) => onChange([...value, ...urls].slice(0, max)))}
              />
              <PickButton label="Ajouter des photos" busy={busy} onClick={() => ref.current?.click()} />
            </>
          )}
        {!enabled && <span className="font-medium text-faint">L&apos;envoi d&apos;images n&apos;est pas encore activé sur la plateforme.</span>}
        </div>
      )}
      {error && (
        <span role="alert" className="text-danger">
          {error}
        </span>
      )}
      {hint && <span className="font-medium text-faint">{hint}</span>}
    </div>
  );
}
