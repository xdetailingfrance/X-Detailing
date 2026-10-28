import { NextResponse } from "next/server";
import { lirePhoto } from "@/lib/photos";
import { trouverRendezVous } from "@/lib/rendezVous";
import { getSession } from "@/lib/session";
import { ANGLES_PHOTO, type AnglePhoto } from "@/lib/types";
import { rendezVousParToken } from "@/lib/workflow";

/**
 * Service d'une photo de prestation.
 *
 * Le stockage est privé : rien n'est accessible par une URL devinable. Trois
 * accès seulement — le client qui détient le jeton de suivi de SON rendez-vous,
 * l'opérateur à qui il est affecté, et l'encadrement. Un commercial ou un
 * comptable n'a rien à faire dans les photos du véhicule d'un client.
 *
 * Le jeton est comparé à celui du rendez-vous demandé, jamais utilisé seul :
 * sans cela, un jeton valide donnerait accès aux photos de n'importe quel
 * autre rendez-vous.
 */
const ROLES_AUTORISES = ["OWNER", "RESPONSABLE"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; etape: string; angle: string }> },
) {
  const { id, etape, angle } = await params;
  if (etape !== "avant" && etape !== "apres") return new NextResponse(null, { status: 404 });
  if (!ANGLES_PHOTO.includes(angle.toUpperCase() as AnglePhoto)) {
    return new NextResponse(null, { status: 404 });
  }

  const rdv = await trouverRendezVous(id);
  if (!rdv) return new NextResponse(null, { status: 404 });

  const token = new URL(request.url).searchParams.get("token");
  let autorise = false;

  if (token) {
    const parToken = await rendezVousParToken(token);
    autorise = parToken?.id === rdv.id;
  }
  if (!autorise) {
    const session = await getSession();
    autorise = Boolean(
      session &&
        ((session.operateurId && session.operateurId === rdv.operateurId) ||
          ROLES_AUTORISES.includes(session.role)),
    );
  }
  if (!autorise) return new NextResponse(null, { status: 403 });

  const photos = etape === "avant" ? rdv.photosAvant : rdv.photosApres;
  const photo = photos.find((p) => p.angle === angle.toUpperCase());
  if (!photo?.chemin) return new NextResponse(null, { status: 404 });

  const fichier = await lirePhoto(photo.chemin);
  if (!fichier?.stream) return new NextResponse(null, { status: 404 });

  return new NextResponse(fichier.stream, {
    headers: {
      "Content-Type": fichier.blob.contentType ?? "image/jpeg",
      // Privée et jamais mise en cache par un intermédiaire : l'autorisation
      // dépend de l'appelant, pas de l'URL.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
