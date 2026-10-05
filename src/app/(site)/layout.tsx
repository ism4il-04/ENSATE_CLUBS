import Link from "next/link";
import { Header } from "@/components/site/Header";
import { BottomNav } from "@/components/site/NavLinks";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="overflow-x-clip">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-11 px-4 pt-5 pb-32 sm:px-6 md:pb-12">
        <Header />
        {children}
        <footer className="flex flex-wrap justify-between gap-3 border-t border-line pt-6 text-[13px] text-muted">
          <span>ensate/clubs — la vie parascolaire de l&apos;ENSA de Tétouan</span>
          <nav aria-label="Informations légales" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/mentions-legales" className="hover:text-paper">
              Mentions légales
            </Link>
            <Link href="/confidentialite" className="hover:text-paper">
              Confidentialité
            </Link>
            <Link href="/conditions" className="hover:text-paper">
              Conditions d&apos;utilisation
            </Link>
          </nav>
        </footer>
      </div>
      <BottomNav />
    </div>
  );
}
