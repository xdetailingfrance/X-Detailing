import { prisma } from "@/server/db";
import { OPTION_DEFS, priceGrid, SERVICE_DEFS, TARIFS, VEHICLE_CLASSES } from "@/server/tarifs";

/**
 * Installe ou corrige le catalogue sur la base visée par DATABASE_URL.
 *
 * Les prestations, leurs tarifs et leurs options ne sont pas éditables depuis le
 * back-office : ils vivent en base, et le jeu de données de démonstration ne sert
 * qu'aux installations neuves — il efface tout avant d'écrire, ce qu'on ne fait pas
 * sur un site en service. Ce script est donc le seul moyen d'installer l'offre sur
 * une base de production, ou d'y corriger un prix.
 *
 * Il est idempotent et strictement additif : rendez-vous, factures, clients et
 * historique ne sont jamais touchés. Les montants déjà facturés sont figés sur le
 * rendez-vous, un changement de grille ne les réécrit pas.
 *
 *     DATABASE_URL="postgres://…" npx tsx scripts/catalogue.ts
 *     DATABASE_URL="postgres://…" npx tsx scripts/catalogue.ts --appliquer
 *
 * Sans `--appliquer`, rien n'est écrit : le script montre ce qu'il ferait.
 */

const apply = process.argv.includes("--appliquer");
const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

async function main(): Promise<void> {
  let changes = 0;
  const say = (line: string) => {
    changes += 1;
    console.log(line);
  };

  for (const def of SERVICE_DEFS) {
    const existing = await prisma.service.findUnique({
      where: { code: def.code },
      include: { pricing: true },
    });

    console.log(`\n${def.name}  (${def.code})`);

    if (!existing) {
      say(`  prestation absente → création`);
      if (apply) {
        await prisma.service.create({
          data: { ...def, pricing: { create: priceGrid(def.code) } },
        });
      }
      continue;
    }

    // Le contenu de la fiche : nom, description, lignes du pack.
    const sameCard =
      existing.name === def.name &&
      existing.slug === def.slug &&
      existing.description === def.description &&
      existing.kind === def.kind &&
      existing.tier === def.tier &&
      existing.active &&
      existing.includes.join("|") === def.includes.join("|");

    if (!sameCard) {
      say(`  fiche à mettre à jour`);
      if (apply) {
        await prisma.service.update({ where: { id: existing.id }, data: { ...def, active: true } });
      }
    }

    const tarif = TARIFS[def.code];
    for (const vehicleClass of VEHICLE_CLASSES) {
      const current = existing.pricing.find((p) => p.vehicleClass === vehicleClass);
      const same =
        current?.priceCents === tarif.priceCents &&
        current?.durationMin === tarif.durationMin &&
        current?.compareAtCents === null;
      if (same) continue;

      const avant = current
        ? `${euros(current.priceCents)} · ${current.durationMin} min${
            current.compareAtCents ? ` · barré ${euros(current.compareAtCents)}` : ""
          }`
        : "absent";
      say(`  ${vehicleClass.padEnd(16)} ${avant} → ${euros(tarif.priceCents)} · ${tarif.durationMin} min`);

      if (!apply) continue;
      await prisma.servicePricing.upsert({
        where: { serviceId_vehicleClass: { serviceId: existing.id, vehicleClass } },
        create: {
          serviceId: existing.id,
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

  // ── Les options ───────────────────────────────────────────────────────────
  console.log("\nOptions");
  for (const [index, def] of OPTION_DEFS.entries()) {
    const existing = await prisma.serviceOption.findUnique({ where: { code: def.code } });
    if (
      existing &&
      existing.name === def.name &&
      existing.priceCents === def.priceCents &&
      existing.durationMin === def.durationMin
    ) {
      continue;
    }

    say(`  ${def.code.padEnd(16)} ${existing ? "à corriger" : "absente → création"}`);
    if (!apply) continue;
    await prisma.serviceOption.upsert({
      where: { code: def.code },
      create: { ...def, sortOrder: index },
      update: { ...def, sortOrder: index, active: true },
    });
  }

  // Le traitement des jantes n'a de sens que là où la carrosserie est lavée.
  if (apply) {
    for (const def of OPTION_DEFS) {
      const option = await prisma.serviceOption.findUnique({ where: { code: def.code } });
      if (!option) continue;

      const codes =
        def.code === "OPT-JANTES" ? ["PACK-LUXE"] : SERVICE_DEFS.map((s) => s.code);
      for (const code of codes) {
        const service = await prisma.service.findUnique({ where: { code } });
        if (!service) continue;
        await prisma.serviceOptionLink.upsert({
          where: { serviceId_optionId: { serviceId: service.id, optionId: option.id } },
          create: { serviceId: service.id, optionId: option.id },
          update: {},
        });
      }
    }
  }

  console.log(
    changes === 0
      ? "\nRien à changer : le catalogue est conforme."
      : apply
        ? `\n${changes} changement(s) appliqué(s).`
        : `\n${changes} changement(s) à appliquer. Relancez avec --appliquer pour écrire.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
