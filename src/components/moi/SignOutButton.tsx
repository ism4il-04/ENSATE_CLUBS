"use client";

import { Icon } from "@/components/ui/Icon";
import { clearPrivateCache } from "@/components/pwa/ServiceWorkerRegister";
import { signOutAction } from "@/server/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOutAction} onSubmit={() => clearPrivateCache()}>
      <button type="submit" className="press flex h-13 w-full items-center justify-center gap-2 rounded-full border border-line-strong font-extrabold">
        <Icon name="logout" /> Se déconnecter
      </button>
    </form>
  );
}
