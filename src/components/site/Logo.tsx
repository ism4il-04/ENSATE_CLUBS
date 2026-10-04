import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-2.5 text-paper" aria-label="ensate/clubs — accueil">
      <span className="grid size-9.5 rotate-[-6deg] place-items-center rounded-xl bg-accent font-display text-xl font-extrabold text-ink">
        e
      </span>
      <span className="font-display text-xl font-bold tracking-tight">
        ensate<span className="text-accent">/</span>clubs
      </span>
    </Link>
  );
}
