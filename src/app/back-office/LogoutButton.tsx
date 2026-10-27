"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

   async function seDeconnecter() {
     await fetch("/api/auth/logout", { method: "POST" });
     router.push("/login");
     router.refresh();
   }

  return (
    <button
      onClick={seDeconnecter}
      className="rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)] transition text-left"
    >
      Déconnexion
      </button>
    );
}

