import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  DEMO_SESSION_COOKIE,
  verifierSession,
  lirePersonaDemo,
  authDesactivee,
  type SessionPayload,
} from "@/lib/auth";
import { accueilDuRole, aLaPermission, permissionRequise } from "@/lib/permissions";

// Permissions par rôle appliquées côté serveur (src/lib/permissions.ts) :
// un rôle non autorisé n'atteint jamais la page NI l'API — impossible de
// contourner l'interface en appelant directement un endpoint.

function estCheminPublic(pathname: string) {
  return (
    pathname.startsWith("/api/auth/") ||
    // Protégé par CRON_SECRET dans la route elle-même (appel Vercel Cron).
    pathname.startsWith("/api/cron/") ||
    // Réservation en ligne (page d'accueil publique) : contrôles dans les routes.
    pathname.startsWith("/api/reservation") ||
    // Webhook Stripe : signature vérifiée dans la route.
    pathname.startsWith("/api/stripe/") ||
    pathname.startsWith("/api/demo/") ||
    pathname.startsWith("/api/suivi/") ||
    pathname.startsWith("/suivi/") ||
    pathname.startsWith("/api/devis-public/") ||
    pathname.startsWith("/devis/")
  );
}

function reponseNonAutorisee(request: NextRequest, pathname: string) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

function reponseInterdite(request: NextRequest, pathname: string, session: SessionPayload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(accueilDuRole(session.role), request.url));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

    if (estCheminPublic(pathname)) {
      return NextResponse.next();
    }

    let session: SessionPayload | null;

    if (authDesactivee()) {
      // Aucun persona choisi via /demo : accès complet par défaut (lien
      // public direct vers le back-office, comme demandé pour la phase de
      // développement). Dès qu'un persona est choisi, on applique les VRAIES
      // règles RBAC ci-dessous pour cette persona — la démo doit refléter le
      // comportement réel de chaque rôle, pas juste tout débloquer.
      const persona = lirePersonaDemo(request.cookies.get(DEMO_SESSION_COOKIE)?.value);
      if (!persona) {
        return NextResponse.next();
      }
      session = persona;
    } else {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      session = token ? await verifierSession(token) : null;
      if (!session) {
        return reponseNonAutorisee(request, pathname);
      }
    }

    const role = session.role;
    // Un OWNER peut être aussi opérateur n°1 (lancement solo — Mathieu) :
    // il garde l'accès complet Direction ET son propre espace opérateur.
    const peutOperer = role === "OPERATEUR" || (!!session.operateurId && role !== "COMPTABLE");

    // API dédiée au pilotage du workflow verrouillé (GPS/photos/signature/
    // paiement) : un compte purement OPERATEUR doit pouvoir l'appeler (seul
    // moyen d'interagir avec /operateur côté client), contrairement au reste
    // de l'API back-office qui lui est fermé plus bas. L'appartenance du RDV
    // à CET opérateur est revérifiée dans la route elle-même (défense en
    // profondeur), jamais déduite du seul rôle.
    if (pathname.startsWith("/api/operateur/")) {
      if (!peutOperer) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      return NextResponse.next();
    }

    if (pathname.startsWith("/operateur")) {
      if (!peutOperer) {
        return NextResponse.redirect(new URL(accueilDuRole(role), request.url));
      }
      return NextResponse.next();
    }

    // Un compte purement opérateur n'a accès qu'à /operateur, jamais au
    // back-office ni aux API de gestion (clients, RDV, packs...).
    if (role === "OPERATEUR") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/operateur", request.url));
    }

    const permission = permissionRequise(pathname);
    if (permission && !aLaPermission(role, permission)) {
      return reponseInterdite(request, pathname, session);
    }
    // Tableau de bord : réservé aux rôles qui pilotent l'activité.
    if ((pathname === "/back-office" || pathname === "/back-office/") && !aLaPermission(role, "planning")) {
      return NextResponse.redirect(new URL(accueilDuRole(role), request.url));
    }

    return NextResponse.next();
}

export const config = {
  matcher: ["/back-office/:path*", "/operateur/:path*", "/api/:path*"],
};

