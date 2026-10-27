import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { journaliser } from "@/lib/audit";
import { DUREE_COOKIE_SECONDES, SESSION_COOKIE, signerSession, verifierMotDePasse } from "@/lib/auth";

// Ne renvoie jamais d'information permettant de distinguer "compte inconnu"
// de "mot de passe invalide", pour ne pas faciliter l'énumération de comptes.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const motDePasse = typeof body?.motDePasse === "string" ? body.motDePasse : "";

    if (!email || !motDePasse) {
      return NextResponse.json({ error: "Identifiants requis" }, { status: 400 });
    }

    const utilisateur = await db.utilisateur.findUnique({ where: { email } });
    if (!utilisateur || !utilisateur.actif) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }

  const motDePasseValide = await verifierMotDePasse(motDePasse, utilisateur.passwordHash);
  if (!motDePasseValide) {
    await journaliser({ acteur: { sub: utilisateur.id, email: utilisateur.email }, action: "CONNEXION_ECHOUEE", entite: "Utilisateur", entiteId: utilisateur.id });
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }
  await journaliser({ acteur: { sub: utilisateur.id, email: utilisateur.email }, action: "CONNEXION", entite: "Utilisateur", entiteId: utilisateur.id });

    const token = await signerSession({
      sub: utilisateur.id,
      role: utilisateur.role,
      operateurId: utilisateur.operateurId,
      email: utilisateur.email,
    });

    const response = NextResponse.json({ role: utilisateur.role });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DUREE_COOKIE_SECONDES,
    });
    return response;
}

