import Link from "next/link";

/** Logo ENSATE clubs : l'étoile zellige (une branche par club) et le nom, « ENSATE » au-dessus de « clubs ». */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-2.5 text-paper" aria-label="ENSATE clubs, plateforme de l'ADE — accueil">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/symbole-fond-sombre.svg" alt="" width={40} height={40} className="size-10 flex-none" />
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-extrabold tracking-[0.34em] text-ade">ENSATE</span>
        <span className="-mt-px font-display text-[25px] font-extrabold tracking-[-0.02em]">clubs</span>
      </span>
    </Link>
  );
}
