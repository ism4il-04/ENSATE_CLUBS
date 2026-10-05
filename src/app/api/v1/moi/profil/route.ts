import { api, ApiError, corps } from "@/server/api/http";
import { requireRole } from "@/server/permissions";
import { mettreAJourProfil, ProfilError, ProfilSchema } from "@/server/services/profil";

// Téléphone, niveau (étudiant) ou organisme (externe).
export const PATCH = api(async (req: Request) => {
  const user = await requireRole("ETUDIANT", "EXTERNE");
  const input = await corps(req, ProfilSchema);
  try {
    await mettreAJourProfil(user, input);
  } catch (e) {
    if (e instanceof ProfilError) throw new ApiError(422, "VALIDATION", e.message, { telephone: e.message });
    throw e;
  }
  return { ok: true };
});
