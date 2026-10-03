import { NextResponse } from "next/server";
import { createSession, destroySession } from "@/lib/auth/session";
import { DEMO_ENABLED, findPersona, resolveIdentity } from "@/server/demo/mode";

/**
 * Lien d'entrée directe dans la démonstration.
 *
 * `/demo/direction`, `/demo/operateur`, `/demo/client` : trois adresses à envoyer
 * séparément, pour que chacun ouvre le parcours qui le concerne sans passer par un
 * sommaire ni choisir dans une liste.
 *
 * Une requête GET ouvre donc une session. C'est assumé ici — c'est le principe d'un lien
 * magique — et cantonné au mode démonstration : hors `DEMO_MODE`, la route n'existe pas.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ persona: string }> },
) {
  if (!DEMO_ENABLED) return new NextResponse("Introuvable", { status: 404 });

  const { persona: key } = await params;
  const persona = findPersona(key);
  if (!persona) {
    // On renvoie vers le sommaire plutôt qu'une erreur : un lien mal recopié doit
    // laisser le visiteur devant quelque chose d'utilisable.
    return NextResponse.redirect(new URL("/demo", request.url));
  }

  if (!persona.email) {
    await destroySession();
    return NextResponse.redirect(new URL(persona.destination, request.url));
  }

  const identity = await resolveIdentity(persona);
  if (!identity) {
    return NextResponse.redirect(new URL("/demo", request.url));
  }

  await createSession(identity);
  return NextResponse.redirect(new URL(persona.destination, request.url));
}
