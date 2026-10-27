import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  DEMO_SESSION_COOKIE,
  DUREE_COOKIE_SECONDES,
  authDesactivee,
  serialiserPersonaDemo,
  type RoleUtilisateur,
  type SessionPayload,
} from "@/lib/auth";

const ROLES_VALIDES: RoleUtilisateur[] = ["OWNER", "RESPONSABLE", "COMMERCIAL", "OPERATEUR", "COMPTABLE"];
const DESTINATION_PAR_ROLE: Record<RoleUtilisateur, string> = {
  OWNER: "/back-office",
  RESPONSABLE: "/back-office",
  COMMERCIAL: "/back-office",
  OPERATEUR: "/operateur",
  COMPTABLE: "/back-office",
};

// Pose le cookie "persona de démo" (page /demo) puis redirige vers
// l'interface correspondante. N'a d'effet que tant que DISABLE_AUTH n'est
// pas explicitement "false" — sans quoi la vraie authentification reprend
// la main et ce cookie n'est jamais lu (voir src/lib/session.ts).
export async function GET(request: Request) {
  if (!authDesactivee()) {
    return NextResponse.json({ error: "Mode démo indisponible (authentification réelle active)" }, { status: 404});
  }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") as RoleUtilisateur | null;
    if (!role || !ROLES_VALIDES.includes(role)) {
      return NextResponse.json({ error: "role invalide" }, { status: 400 });
    }

    // Se rattache à un vrai compte seedé pour que l'e-mail affiché et le
    // lien opérateur soient cohérents avec les données de démonstration.
    const utilisateur = await db.utilisateur.findFirst({ where: { role }, orderBy: { createdAt: "asc" } });

    const payload: SessionPayload = {
      sub: utilisateur?.id ?? `demo-${role.toLowerCase()}`,
      role,
      operateurId: utilisateur?.operateurId ?? null,
      email: utilisateur?.email ?? `demo-${role.toLowerCase()}@xdetailing.fr`,
    };

    const response = NextResponse.redirect(new URL(DESTINATION_PAR_ROLE[role], request.url));
    response.cookies.set(DEMO_SESSION_COOKIE, serialiserPersonaDemo(payload), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: DUREE_COOKIE_SECONDES,
    });
    return response;
}

