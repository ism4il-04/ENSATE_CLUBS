import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Hors ligne" };

export default function HorsLigne() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/icone-app.svg" alt="ENSATE clubs" width={88} height={88} className="size-22" />
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Pas de réseau</h1>
      <p className="text-muted">
        Cette page n&apos;est pas disponible hors ligne. Tes billets à venir, enregistrés sur ce téléphone, restent
        accessibles depuis « Mes billets ».
      </p>
      <Link href="/moi/billets" className="press rounded-full bg-accent px-6 py-3 font-extrabold text-ink">
        Mes billets
      </Link>
    </main>
  );
}
