import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
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

/**
 * Connexion de démonstration : uniquement en développement local avec AUTH_DEV_LOGIN=1,
 * et seulement vers un compte existant et actif. Jamais disponible en production.
 */
export const DEV_LOGIN = process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "1";

const devProvider = Credentials({
  id: "dev",
  name: "Démo",
  credentials: { email: {} },
  async authorize(credentials) {
    if (!DEV_LOGIN) return null;
    const email = String(credentials?.email ?? "").trim().toLowerCase();
    const [c] = await getDb().select().from(schema.compte).where(eq(schema.compte.email, email)).limit(1);
    if (!c || c.statut !== "ACTIF") return null;
    return { id: c.id, email: c.email };
  },
});

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
  // Le sub Google l'emporte sur l'email (l'adresse peut changer). Un compte trouvé par email mais déjà lié
  // à un autre compte Google n'est pas celui de cette personne : on ne s'y connecte pas.
  return rows.find((c) => c.googleSub === sub) ?? rows.find((c) => c.googleSub === null) ?? null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({ authorization: { params: { prompt: "select_account" } } }), ...(DEV_LOGIN ? [devProvider] : [])],
  pages: { signIn: "/connexion", error: "/connexion" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    // RG-01 : connexion Google uniquement, adresse vérifiée.
    async signIn({ account, profile }) {
      if (account?.provider === "dev") return DEV_LOGIN;
      if (account?.provider !== "google") return false;
      const p = (profile ?? {}) as GoogleProfile;
      const email = p.email?.trim().toLowerCase();
      if (!email || p.email_verified !== true) return REFUS;

      const db = getDb();
      const sub = account.providerAccountId;
      const existing = await findCompte(sub, email);
      if (!existing) {
        // Adresse déjà liée à un autre compte Google : refus plutôt que doublon.
        const [taken] = await db.select({ id: schema.compte.id }).from(schema.compte).where(eq(schema.compte.email, email)).limit(1);
        if (taken) return REFUS;
      }

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

      const isDev = account ? account.provider === "dev" : token.dev === true;
      let c;
      if (isDev) {
        if (!DEV_LOGIN) return null;
        const id = account?.providerAccountId ?? (token.uid as string | undefined);
        if (!id) return null;
        [c] = await getDb().select().from(schema.compte).where(eq(schema.compte.id, id)).limit(1);
      } else {
        const sub = account?.providerAccountId ?? (token.googleSub as string | undefined);
        if (!sub) return null;
        c = await findCompte(sub, (token.email ?? "").toLowerCase());
        token.googleSub = sub;
      }
      if (!c || c.statut !== "ACTIF") return null; // compte suspendu → déconnexion

      token.uid = c.id;
      token.role = c.role;
      token.dev = isDev || undefined;
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
