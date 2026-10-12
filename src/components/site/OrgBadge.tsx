import { imageUrl } from "@/lib/images";

/**
 * Pastille d'une organisation : son logo en entier sur la couleur du club (les logos sans fond, clairs
 * ou foncés, restent lisibles), sinon son sigle, avec une taille de texte adaptée à sa longueur.
 */
export function OrgBadge({
  nom,
  sigle,
  couleur,
  logoUrl,
  size,
  className = "",
}: {
  nom: string;
  sigle: string | null;
  couleur: string;
  logoUrl?: string | null;
  size: number;
  className?: string;
}) {
  const texte = (sigle || nom.slice(0, 2)).toUpperCase();
  const echelle = texte.length <= 2 ? 0.4 : texte.length <= 3 ? 0.34 : texte.length <= 5 ? 0.26 : 0.2;
  return (
    <span
      className={`grid flex-none place-items-center overflow-hidden font-display font-extrabold tracking-tight text-ink ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: couleur, fontSize: Math.round(size * echelle) }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl(logoUrl, Math.min(512, size * 3))} alt={`Logo ${nom}`} className="size-[84%] object-contain" />
      ) : (
        texte
      )}
    </span>
  );
}
