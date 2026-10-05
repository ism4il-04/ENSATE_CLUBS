import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ensate/clubs — vie parascolaire de l'ENSA Tétouan",
    short_name: "ensate/clubs",
    description: "Événements des clubs, inscriptions, billets et stands.",
    lang: "fr",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0C12",
    theme_color: "#0B0C12",
    categories: ["education", "events", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mes billets", url: "/moi/billets", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Événements", url: "/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Espace club", short_name: "Club", description: "Stand, caisse et contrôle d'entrée", url: "/org", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
    prefer_related_applications: false,
  };
}
