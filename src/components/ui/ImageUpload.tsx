"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { imageUrl } from "@/lib/images";

type Folder = "ensate-clubs/affiches" | "ensate-clubs/plannings" | "ensate-clubs/logos";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_BYTES = 10 * 1024 * 1024; // limite du plan gratuit Cloudinary
const field = "h-11 min-w-0 rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 text-sm font-semibold text-paper outline-none focus:border-accent";

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
  name,
  label,
  hint,
}: {
  folder: Folder;
  enabled: boolean;
  value: string;
  onChange: (url: string) => void;
  name?: string;
  label: string;
  hint?: string;
}) {
  const { busy, error, ref, run } = useUploader(folder);
  const [link, setLink] = useState(!enabled);

  return (
    <div className="flex flex-col gap-2 text-[13px] font-bold text-muted">
      <span>{label}</span>
      {name && <input type="hidden" name={name} value={value} />}
      <div className="flex flex-wrap items-center gap-3">
        {/^(https:\/\/|\/logos\/)/.test(value) ? (
          // Aperçu dans l'espace club : simple <img>, l'image peut venir de n'importe quel hôte https.
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
        {value && !busy && (
          <button type="button" onClick={() => onChange("")} className="press flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-muted hover:text-danger">
            <Icon name="trash" stroke={2.2} /> Retirer
          </button>
        )}
      </div>
      {link ? (
        <input value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder="https://… (lien vers l'image)" aria-label={`${label} : lien`} className={field} />
      ) : (
        <button type="button" onClick={() => setLink(true)} className="self-start text-[13px] font-bold text-faint underline underline-offset-2">
          ou coller un lien
        </button>
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
  const { busy, error, setError, ref, run } = useUploader(folder);
  const [link, setLink] = useState("");
  const room = max - value.length;

  function addLink() {
    const u = link.trim();
    if (!/^https:\/\/\S+$/.test(u)) return setError("Le lien doit commencer par https://");
    setError(null);
    onChange([...value, u].slice(0, max));
    setLink("");
  }

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
          <div className="flex min-w-60 flex-1 gap-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
              }}
              placeholder={enabled ? "ou coller un lien https://…" : "https://… (lien vers l'image)"}
              aria-label={`${label} : ajouter un lien`}
              className={`${field} flex-1`}
            />
            <button type="button" onClick={addLink} disabled={!link.trim()} className="press h-11 rounded-full border-[1.5px] border-line-strong px-4 text-sm font-extrabold text-paper disabled:opacity-50">
              Ajouter
            </button>
          </div>
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
