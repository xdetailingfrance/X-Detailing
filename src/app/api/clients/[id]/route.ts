import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { obstacleSuppressionClient } from "@/lib/clients";
import { journaliser } from "@/lib/audit";

// Suppression d'une fiche client, avec ses adresses, véhicules et
// rendez-vous sans trace comptable (cascade au niveau du schéma pour les
// deux premiers). Réservée à la direction : c'est une perte de données
// volontaire, pas une correction de saisie.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "RESPONSABLE") {
    return NextResponse.json({ error: "Seule la direction peut supprimer un client." }, { status: 403 });
  }

  const { id } = await params;
  const client = await db.client.findUnique({
    where: { id },
    include: { rendezVous: { select: { id: true } }, _count: { select: { adresses: true, vehicules: true } } },
  });
  if (!client) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const obstacle = await obstacleSuppressionClient(id);
  if (obstacle) return NextResponse.json({ error: obstacle }, { status: 409 });

  // Le journal n'est jamais purgé : la fiche disparaît, pas la trace de sa
  // suppression ni de ce qu'elle contenait.
  await journaliser({
    acteur: session,
    action: "CLIENT_SUPPRIME",
    entite: "Client",
    entiteId: id,
    details: {
      nom: `${client.prenom} ${client.nom}`,
      telephone: client.telephone,
      email: client.email,
      rendezVousSupprimes: client.rendezVous.length,
      adresses: client._count.adresses,
      vehicules: client._count.vehicules,
    },
  });

  // Les rendez-vous ne tombent pas en cascade (relation obligatoire) : ils
  // sont retirés explicitement, après la vérification ci-dessus.
  await db.$transaction([
    db.rendezVous.deleteMany({ where: { clientId: id } }),
    db.client.delete({ where: { id } }),
  ]);

  return NextResponse.json({ supprime: true, rendezVousSupprimes: client.rendezVous.length });
}
