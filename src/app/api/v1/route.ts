import { api } from "@/server/api/http";

// Point d'entrée de l'API : version et liste des ressources (contrat détaillé : docs/07_API.md).
export const GET = api(
  async () => ({
    version: "1",
    authentification: "cookie de session (connexion Google sur le site)",
    ressources: {
      public: ["GET /evenements", "GET /evenements/{slug}", "GET /organisations", "GET /organisations/{slug}", "GET /lieux"],
      participant: ["GET /moi", "PATCH /moi/profil", "POST /evenements/{slug}/inscriptions", "GET /moi/inscriptions", "GET|DELETE /moi/inscriptions/{id}"],
      organisation: [
        "GET /org",
        "GET /org/evenements",
        "GET /org/evenements/{id}/inscriptions",
        "POST /org/evenements/{id}/stand",
        "GET /org/stand/{session}/jeton",
        "DELETE /org/stand/{session}",
        "POST|DELETE /org/inscriptions/{id}/paiement",
        "POST /org/paiements/scan",
        "POST /org/checkin",
      ],
    },
  }),
  { public: true },
);
