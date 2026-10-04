"use server";

import { DEV_LOGIN, signIn, signOut } from "@/auth";

/** N'accepte qu'un chemin interne (évite les redirections ouvertes). */
function safePath(p: FormDataEntryValue | null) {
  const s = typeof p === "string" ? p : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safePath(formData.get("retour")) });
}

/** Connexion de démonstration (développement local uniquement). */
export async function devSignIn(formData: FormData) {
  if (!DEV_LOGIN) return;
  await signIn("dev", { email: String(formData.get("email") ?? ""), redirectTo: safePath(formData.get("retour")) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
