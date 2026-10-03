"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSession, destroySession } from "@/lib/auth/session";
import { DEMO_ENABLED, findPersona, resolveIdentity, resetDemo } from "@/server/demo/mode";

/**
 * Entre dans la démonstration sous une identité donnée.
 *
 * On ouvre la session sans mot de passe : c'est précisément ce qu'un mode démonstration
 * doit permettre, et précisément ce qu'une production ne doit jamais permettre. D'où le
 * refus net hors `DEMO_MODE`.
 */
export async function enterAs(formData: FormData): Promise<void> {
  if (!DEMO_ENABLED) throw new Error("Mode démonstration inactif.");

  const persona = findPersona(String(formData.get("persona") ?? ""));
  if (!persona) throw new Error("Point de vue inconnu.");

  // Le visiteur client n'a pas de compte : on efface au contraire toute session en cours,
  // sinon on verrait le site public avec la barre d'administration d'un rôle précédent.
  if (!persona.email) {
    await destroySession();
    redirect(persona.destination);
  }

  const identity = await resolveIdentity(persona);
  if (!identity) {
    throw new Error(
      "Ce compte n'existe pas dans le jeu de données : remettez la démonstration à zéro.",
    );
  }

  await createSession(identity);
  redirect(persona.destination);
}

/** Régénère le jeu de données fictif et efface tout ce qui a été produit pendant l'essai. */
export async function resetDemoData(): Promise<void> {
  if (!DEMO_ENABLED) throw new Error("Mode démonstration inactif.");

  await resetDemo();
  // La session pointait vers des identifiants qui n'existent plus.
  await destroySession();
  revalidatePath("/", "layout");
}
