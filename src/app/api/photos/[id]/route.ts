import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { currentUser } from "@/lib/auth/guard";
import { storageProvider } from "@/lib/providers/storage";

/**
 * Service des preuves photo (§31).
 *
 * Les photos ne sont pas dans `public/` : elles montrent un véhicule, souvent sa plaque,
 * devant le domicile du client. Chaque accès est donc authentifié et filtré par rôle —
 * un opérateur ne voit que les siennes.
 */

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: {
      path: true,
      appointment: { select: { operatorId: true, publishable: true } },
    },
  });

  if (!photo) return new NextResponse("Introuvable", { status: 404 });

  // Seul l'accord explicite du client ouvre une photo au public (§13). Sans lui, on
  // repasse par l'authentification : c'est la case cochée qui autorise, rien d'autre.
  if (!photo.appointment.publishable) {
    const user = await currentUser();
    if (!user) return new NextResponse("Non authentifié", { status: 401 });

    const allowed =
      user.role === "ADMIN" ||
      user.role === "DISPATCHER" ||
      (user.role === "OPERATOR" && photo.appointment.operatorId === user.operatorId);

    // 404 plutôt que 403 : un opérateur n'a pas à apprendre qu'une photo existe ailleurs.
    if (!allowed) return new NextResponse("Introuvable", { status: 404 });
  }

  try {
    const data = await storageProvider().get(photo.path);
    const extension = photo.path.split(".").pop() ?? "jpg";

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        // Une photo publiée peut être mise en cache par un intermédiaire ; les
        // autres montrent le véhicule d'un client et restent strictement privées.
        "Cache-Control": photo.appointment.publishable
          ? "public, max-age=86400, immutable"
          : "private, max-age=3600",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new NextResponse("Fichier absent du stockage", { status: 410 });
  }
}
