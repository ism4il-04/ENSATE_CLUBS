import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], display: "swap" });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "ensate/clubs", template: "%s · ensate/clubs" },
  description: "Les événements des clubs et associations de l'ENSA de Tétouan : inscriptions, billets et stands.",
  applicationName: "ensate/clubs",
  appleWebApp: { capable: true, title: "ensate/clubs", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0B0C12",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${bricolage.variable} ${figtree.variable} antialiased`}>
      <body className="min-h-dvh bg-ink text-paper">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
