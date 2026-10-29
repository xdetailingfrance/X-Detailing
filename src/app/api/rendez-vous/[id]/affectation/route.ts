import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { assurerGeocodageOperateurs, diagnostiquerAbsenceDeCandidat, evaluerCandidats } from "@/lib/affectation";
import { trouverRendezVous } from "@/lib/rendezVous";
import { assurerGeocodage } from "@/lib/clients";

// « TROUVER LE MEILLEUR OPÉRATEUR » : analyse tous les opérateurs
// éligibles, classe les meilleurs candidats et conserve la proposition.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rendezVous = await trouverRendezVous(id);
  if (!rendezVous) {
    return NextResponse.json({ error: "rendez-vous introuvable" }, { status: 404 });
  }
  // Le géocodage est retenté ici plutôt que simplement constaté manquant :
  // une adresse arrivée sans coordonnées (devis converti, saisie manuelle)
  // rendait le rendez-vous définitivement inaffectable, alors qu'elle est
  // souvent reconnue à la seconde tentative. Le résultat est enregistré.
  const point = await assurerGeocodage(rendezVous.adresseId);
  if (!point) {
    const adresse = await db.adresse.findUnique({ where: { id: rendezVous.adresseId } });
    return NextResponse.json(
      {
        error: adresse
          ? `L'adresse « ${adresse.adresse}, ${adresse.ville} » n'est pas reconnue par la Base Adresse Nationale : corrigez-la sur la fiche du client pour pouvoir affecter un opérateur.`
          : "adresse du rendez-vous introuvable",
      },
      { status: 400 }
    );
  }

    // Même réparation côté opérateurs : une fiche sans coordonnées est
    // ignorée sans un mot par le moteur.
    const operateurs = await assurerGeocodageOperateurs();
    if (operateurs.exploitables === 0) {
      return NextResponse.json(
        {
          error:
            operateurs.actifs === 0
              ? "Aucun opérateur actif : créez une fiche opérateur avant d'affecter un rendez-vous."
              : "Aucun opérateur actif n'a d'adresse de domicile exploitable. Renseignez-la sur sa fiche : sans elle, le moteur ne peut calculer aucun trajet.",
        },
        { status: 400 }
      );
    }

    const criteres = {
      latitude: point.latitude,
      longitude: point.longitude,
      dateHeure: rendezVous.dateHeure,
      dureeMinutes: rendezVous.dureeMinutes,
      excludeRendezVousId: rendezVous.id,
    };
    const candidats = await evaluerCandidats(criteres);

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
    return NextResponse.json({
      candidats: candidatsExposes,
      ...(candidats.length === 0 ? { raison: await diagnostiquerAbsenceDeCandidat(criteres) } : {}),
    });
}

