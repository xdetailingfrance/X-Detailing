import { prisma } from "@/server/db";
import { TARIFS, VEHICLE_CLASSES } from "@/server/tarifs";

/**
 * Applique la grille de `server/tarifs.ts` à la base visée par DATABASE_URL.
 *
 * Les tarifs ne sont pas éditables depuis le back-office : ils vivent en base, et le
 * fichier de jeu de données ne concerne que les installations neuves. Ce script est
 * donc le seul moyen de corriger un prix sur un site déjà en service.
 *
 * Il est idempotent et ne touche qu'aux lignes tarifaires : aucun rendez-vous, aucune
 * facture, aucun historique n'est modifié. Les montants déjà facturés sont figés sur
 * le rendez-vous, un changement de grille ne les réécrit pas.
 *
 *     DATABASE_URL="postgres://…" npx tsx scripts/tarifs.ts
 *     DATABASE_URL="postgres://…" npx tsx scripts/tarifs.ts --appliquer
 *
 * Sans `--appliquer`, rien n'est écrit : le script montre ce qu'il changerait.
 */

const apply = process.argv.includes("--appliquer");
const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

async function main(): Promise<void> {
  const services = await prisma.service.findMany({
    where: { code: { in: Object.keys(TARIFS) } },
    include: { pricing: true },
  });

  const absents = Object.keys(TARIFS).filter((code) => !services.some((s) => s.code === code));
  if (absents.length > 0) {
    throw new Error(`Prestations introuvables en base : ${absents.join(", ")}`);
  }

  let changes = 0;

  for (const service of services) {
    const tarif = TARIFS[service.code];
    console.log(`\n${service.name}  (${service.code})`);
    console.log(`  cible : ${euros(tarif.priceCents)} · ${tarif.durationMin} min`);

    for (const vehicleClass of VEHICLE_CLASSES) {
      const current = service.pricing.find((p) => p.vehicleClass === vehicleClass);
      const same =
        current?.priceCents === tarif.priceCents &&
        current?.durationMin === tarif.durationMin &&
        current?.compareAtCents === null;

      if (same) continue;
      changes += 1;

      const avant = current
        ? `${euros(current.priceCents)} · ${current.durationMin} min${
            current.compareAtCents ? ` · barré ${euros(current.compareAtCents)}` : ""
          }`
        : "absent";
      console.log(`  ${vehicleClass.padEnd(16)} ${avant}`);

      if (!apply) continue;

      await prisma.servicePricing.upsert({
        where: { serviceId_vehicleClass: { serviceId: service.id, vehicleClass } },
        create: {
          serviceId: service.id,
          vehicleClass,
          priceCents: tarif.priceCents,
          compareAtCents: null,
          durationMin: tarif.durationMin,
        },
        update: {
          priceCents: tarif.priceCents,
          compareAtCents: null,
          durationMin: tarif.durationMin,
        },
      });
    }
  }

  console.log(
    changes === 0
      ? "\nRien à changer : la base est déjà à la grille."
      : apply
        ? `\n${changes} ligne(s) tarifaire(s) mise(s) à jour.`
        : `\n${changes} ligne(s) à changer. Relancez avec --appliquer pour écrire.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
