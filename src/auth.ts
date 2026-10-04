import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { eq, or } from "drizzle-orm";
import { getDb, schema } from "@/server/db";

export type Role = (typeof schema.roleCompte.enumValues)[number];

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
}

const ETU_DOMAIN = "@etu.uae.ac.ma";
const REFRESH_MS = 5 * 60 * 1000; // relecture du rôle / statut toutes les 5 min
const REFUS = "/connexion?erreur=COMPTE_NON_AUTORISE";

type GoogleProfile = {
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
};

async function findCompte(sub: string, email: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.compte)
    .where(or(eq(schema.compte.googleSub, sub), eq(schema.compte.email, email)))
    .limit(2);
  // Le sub Google l'emporte sur l'email (l'adresse peut changer).
  return rows.find((c) => c.googleSub === sub) ?? rows[0] ?? null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({ authorization: { params: { prompt: "select_account" } } })],
  pages: { signIn: "/connexion", error: "/connexion" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    // RG-01 : connexion Google uniquement, adresse vérifiée.
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      const p = (profile ?? {}) as GoogleProfile;
      const email = p.email?.trim().toLowerCase();
      if (!email || p.email_verified !== true) return REFUS;

      const db = getDb();
      const sub = account.providerAccountId;
      const existing = await findCompte(sub, email);

      if (existing) {
        if (existing.statut !== "ACTIF") return REFUS; // RG-24
        // Compte créé par le staff : il garde son rôle et s'active ici.
        await db
          .update(schema.compte)
          .set({ googleSub: existing.googleSub ?? sub, derniereConnexion: new Date() })
          .where(eq(schema.compte.id, existing.id));
        return true;
      }

      const role: Role = email.endsWith(ETU_DOMAIN) ? "ETUDIANT" : "EXTERNE";
      const [created] = await db
        .insert(schema.compte)
        .values({ email, googleSub: sub, role, derniereConnexion: new Date() })
        .onConflictDoNothing()
        .returning({ id: schema.compte.id });
      if (created) {
        await db.insert(schema.personne).values({
          idCompte: created.id,
          prenom: p.given_name ?? p.name ?? email.split("@")[0],
          nom: p.family_name ?? "",
          photoUrl: p.picture ?? null,
        });
      }
      return true;
    },

    async jwt({ token, account }) {
      const now = Date.now();
      const fresh = typeof token.checkedAt === "number" && now - token.checkedAt < REFRESH_MS;
      if (!account && fresh) return token;

      const sub = account?.providerAccountId ?? (token.googleSub as string | undefined);
      if (!sub) return null;
      const c = await findCompte(sub, (token.email ?? "").toLowerCase());
      if (!c || c.statut !== "ACTIF") return null; // compte suspendu → déconnexion

      token.uid = c.id;
      token.role = c.role;
      token.googleSub = sub;
      token.checkedAt = now;
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
});
