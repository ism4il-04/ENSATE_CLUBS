import { api } from "@/server/api/http";
import { mesOrganisations, requireRole } from "@/server/permissions";
import { getPersonne } from "@/server/queries/moi";

// Compte connecté, profil, et organisations dont il fait partie (compte du club ou membre).
export const GET = api(async () => {
  const user = await requireRole();
  const [p, orgs] = await Promise.all([getPersonne(user.id), mesOrganisations(user.id, user.role)]);
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    profil: p ? { prenom: p.prenom, nom: p.nom, photoUrl: p.photoUrl, telephone: p.telephone, niveau: p.niveau, organisme: p.organisme } : null,
    organisations: orgs.map((o) => ({ id: o.org.id, nom: o.org.nom, slug: o.org.slug, acces: o.acces })),
  };
});
