import { prisma } from "@/server/db";
import { OPTION_DEFS, priceGrid, SERVICE_DEFS, TARIFS, VEHICLE_CLASSES } from "@/server/tarifs";
import { REGION, SECTORS } from "@/server/territoire";
import { hashPassword } from "@/lib/auth/password";

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

/** Nom affiché du compte d'administration à défaut de mieux. */
const BUSINESS_SHORT = "X Detailing";
const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

async function main(): Promise<void> {
  let changes = 0;
  const say = (line: string) => {
    changes += 1;
    console.log(line);
  };

  // ── Le compte d'administration ────────────────────────────────────────────
  /*
   * Sans administrateur, le back-office est inatteignable : on ne peut ni créer un
   * opérateur, ni consulter une alerte, ni rien faire d'autre. Le jeu de démonstration
   * en créait un, mais il n'a pas sa place sur une base en service — il efface tout
   * avant d'écrire.
   *
   * Le compte n'est créé qu'une fois, et seulement s'il n'existe aucun administrateur.
   * Un mot de passe changé depuis l'interface ne doit jamais être réécrit par un
   * déploiement, et une variable oubliée dans l'environnement ne doit pas rouvrir un
   * accès qu'on croyait fermé.
   */
  console.log("Administration");
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (admins > 0) {
    console.log(`  ${admins} administrateur(s) déjà en place — rien à faire`);
  } else {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      console.log("  aucun administrateur, et ADMIN_EMAIL / ADMIN_PASSWORD absentes");
      console.log("  → le back-office restera inaccessible tant qu'elles ne sont pas posées");
    } else if (password.length < 12) {
      throw new Error("ADMIN_PASSWORD trop court : 12 caractères minimum");
    } else {
      say(`  création du compte ${email}`);
      if (apply) {
        await prisma.user.create({
          data: {
            email,
            passwordHash: await hashPassword(password),
            role: "ADMIN",
            firstName: process.env.ADMIN_FIRSTNAME?.trim() || "Direction",
            lastName: process.env.ADMIN_LASTNAME?.trim() || BUSINESS_SHORT,
          },
        });
      }
    }
  }

  // ── Le territoire ─────────────────────────────────────────────────────────
  // Avant le catalogue : sans secteur, aucun opérateur ne peut être créé depuis le
  // back-office, et la chaîne de réservation reste fermée quoi qu'on installe ensuite.
  console.log("Territoire");
  const region = await prisma.region.findUnique({ where: { code: REGION.code } });
  if (!region) {
    say(`  région ${REGION.code} absente → création`);
  }
  const regionId = apply
    ? (
        await prisma.region.upsert({
          where: { code: REGION.code },
          create: { ...REGION },
          update: { name: REGION.name },
          select: { id: true },
        })
      ).id
    : (region?.id ?? null);

  for (const sector of SECTORS) {
    const existing = await prisma.sector.findUnique({ where: { code: sector.code } });
    if (existing && existing.name === sector.name && existing.active) continue;

    say(`  secteur ${sector.code.padEnd(18)} ${existing ? "à corriger" : "absent → création"}`);
    if (!apply || !regionId) continue;
    await prisma.sector.upsert({
      where: { code: sector.code },
      create: { ...sector, regionId },
      update: { name: sector.name, active: true, regionId },
    });
  }

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
      existing.category === def.category &&
      existing.priceCents === def.priceCents &&
      existing.durationMin === def.durationMin &&
      existing.sortOrder === index &&
      existing.active
    ) {
      continue;
    }

    say(`  ${def.code.padEnd(22)} ${existing ? "à corriger" : "absente → création"}`);
    if (!apply) continue;
    await prisma.serviceOption.upsert({
      where: { code: def.code },
      create: { ...def, sortOrder: index },
      update: { ...def, sortOrder: index, active: true },
    });
  }

  /*
   * Les options retirées du catalogue sont désactivées, jamais supprimées : des
   * rendez-vous passés les référencent, et une facture doit rester lisible des années
   * après. Désactivée, l'option disparaît de la vente sans trouer l'historique.
   */
  const retirees = await prisma.serviceOption.findMany({
    where: { active: true, code: { notIn: OPTION_DEFS.map((o) => o.code) } },
    select: { id: true, code: true },
  });
  for (const retiree of retirees) {
    say(`  ${retiree.code.padEnd(22)} retirée du catalogue → désactivation`);
    if (!apply) continue;
    await prisma.serviceOption.update({ where: { id: retiree.id }, data: { active: false } });
  }

  // Toutes les options portent sur l'habitacle : les deux formules les acceptent.
  if (apply) {
    for (const def of OPTION_DEFS) {
      const option = await prisma.serviceOption.findUnique({ where: { code: def.code } });
      if (!option) continue;

      for (const { code } of SERVICE_DEFS) {
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
