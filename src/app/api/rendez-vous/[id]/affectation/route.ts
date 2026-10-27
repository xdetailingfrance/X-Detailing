import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { evaluerCandidats } from "@/lib/affectation";
import { trouverRendezVous } from "@/lib/rendezVous";

// « TROUVER LE MEILLEUR OPÉRATEUR » : analyse tous les opérateurs
// éligibles, classe les meilleurs candidats et conserve la proposition.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rendezVous = await trouverRendezVous(id);
  if (!rendezVous) {
    return NextResponse.json({ error: "rendez-vous introuvable" }, { status: 404 });
  }
  const adresse = await db.adresse.findUnique({ where: { id: rendezVous.adresseId } });
  if (!adresse || adresse.latitude == null || adresse.longitude == null) {
    return NextResponse.json({ error: "adresse du rendez-vous non géocodée (latitude/longitude manquantes)" }, {status: 400 });
  }

    const candidats = await evaluerCandidats({
      latitude: adresse.latitude,
      longitude: adresse.longitude,
      dateHeure: rendezVous.dateHeure,
      dureeMinutes: rendezVous.dureeMinutes,
      excludeRendezVousId: rendezVous.id,
    });

    await db.$transaction([
      db.affectationCandidat.deleteMany({ where: { rendezVousId: id } }),
      db.affectationCandidat.createMany({
        data: candidats.map((c, index) => ({
          rendezVousId: id,
          operateurId: c.operateurId,
          score: c.score,
          distanceKm: c.distanceKm,
          etaMinutes: c.etaMinutes,
          rang: index + 1,
        })),
      }),
    ]);

    // Le CA d'un opérateur est une donnée financière : réservée au directeur.
    const session = await getSession();
    const candidatsExposes = candidats.map((c) => (session?.role === "OWNER" ? c : { ...c, caJour: undefined }));
    return NextResponse.json({ candidats: candidatsExposes });
}

