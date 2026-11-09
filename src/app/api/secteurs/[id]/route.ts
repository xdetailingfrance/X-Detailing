import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { geocoderAdresse } from "@/lib/geo";
import { journaliser } from "@/lib/audit";

/**
 * Périmètre d'un secteur : la ville qui le centre et le rayon couvert.
 *
 * Le centre est géocodé à partir de la ville — pas de garde-fou de zone ici,
 * justement parce qu'un secteur peut être à Toulouse ou ailleurs : c'est
 * tout l'objet d'en créer un.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  if (!(await db.secteur.findUnique({ where: { id } }))) {
    return NextResponse.json({ error: "secteur introuvable" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const ville = typeof body?.ville === "string" ? body.ville.trim().slice(0, 80) : null;
  const rayonKm = body?.rayonKm == null || body.rayonKm === "" ? null : Number(body.rayonKm);
  if (rayonKm != null && (!Number.isFinite(rayonKm) || rayonKm <= 0 || rayonKm > 300)) {
    return NextResponse.json({ error: "Rayon invalide (1 à 300 km)." }, { status: 400 });
  }

  // Barème : « 10:0, 20:10, 30:15 » — au-delà de la dernière borne, tarif
  // particulier. Vide : le secteur retombe sur le barème par défaut.
  let tranches: { jusquaKm: number; prix: number }[] | null = null;
  if (typeof body?.bareme === "string" && body.bareme.trim()) {
    tranches = [];
    for (const morceau of body.bareme.split(",")) {
      const [km, prix] = morceau.split(/[:=]/).map((x: string) => Number(x.trim().replace(",", ".")));
      if (!Number.isFinite(km) || km <= 0 || !Number.isFinite(prix) || prix < 0) {
        return NextResponse.json(
          { error: "Barème illisible. Format attendu : « 10:0, 20:10, 30:15 » (kilomètres : euros)." },
          { status: 400 }
        );
      }
      tranches.push({ jusquaKm: km, prix });
    }
    tranches.sort((a, b) => a.jusquaKm - b.jusquaKm);
  }

  const point = ville ? await geocoderAdresse("", ville, null) : null;
  if (ville && !point) {
    return NextResponse.json({ error: `Ville « ${ville} » introuvable.` }, { status: 400 });
  }

  const secteur = await db.secteur.update({
    where: { id },
    data: {
      ville,
      rayonKm,
      tranches: tranches ?? Prisma.DbNull,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
      ...(typeof body?.nom === "string" && body.nom.trim() ? { nom: body.nom.trim().slice(0, 80) } : {}),
    },
  });
  await journaliser({
    acteur: session,
    action: "SECTEUR_PERIMETRE",
    entite: "Secteur",
    entiteId: id,
    details: { ville, rayonKm, tranches, geocode: point != null },
  });
  return NextResponse.json(secteur);
}
