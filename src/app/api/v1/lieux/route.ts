import { api } from "@/server/api/http";
import { listLieux } from "@/server/queries/org";

// 🌐 Lieux actifs de l'école.
export const GET = api(async () => (await listLieux()).map((l) => ({ id: l.id, code: l.code, nom: l.nom, type: l.type, etage: l.etage, capacite: l.capacite })), { public: true });
