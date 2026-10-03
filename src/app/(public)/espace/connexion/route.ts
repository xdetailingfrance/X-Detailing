import { NextResponse } from "next/server";
import { openCustomerSession } from "../actions";

/**
 * Atterrissage du lien d'accès (§24).
 *
 * Un *route handler* et non une page : Next n'autorise l'écriture de cookies que dans
 * une action serveur ou un gestionnaire de route — pas pendant le rendu d'une page.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("jeton");
  const origin = new URL(request.url).origin;

  if (token && (await openCustomerSession(token))) {
    return NextResponse.redirect(new URL("/espace/mes-rendez-vous", origin));
  }

  return NextResponse.redirect(new URL("/espace?erreur=lien", origin));
}
