// Logos par défaut fournis avec le site (public/logos), par adresse de la page du club.
// Un club peut les remplacer par une image envoyée, puis revenir à celui-ci.
const LOGOS_PAR_DEFAUT: Record<string, string> = {
  "association-des-etudiants": "/logos/ade.png",
  "ensate-chess-club": "/logos/echecs.png",
  cyberguardians: "/logos/cyberguardians.png",
  "club-mecatronique": "/logos/mecatronique.png",
  "club-logistica": "/logos/logistica.png",
  ensart: "/logos/ensart.png",
  "club-genie-civil": "/logos/genie-civil.png",
  "enactus-ensa-tetouan": "/logos/enactus.png",
  "infotech-club": "/logos/infotech.png",
  "club-d-echange-culturel": "/logos/cetec.png",
  "ensate-sport": "/logos/sport.png",
  "association-futurs-ingenieurs": "/logos/afi.png",
};

export const logoParDefaut = (slug: string): string | null => LOGOS_PAR_DEFAUT[slug] ?? null;
