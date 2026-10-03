import "dotenv/config";
import { prisma } from "@/server/db";
import { runJobByName, getJobStatus } from "@/server/jobs";
import { getLoyaltyRule, saveLoyaltyRule, getAvailableReward, rewardDiscountCents } from "@/server/loyalty";
import { previewInvoice, issueInvoice, getFleetAccounts } from "@/server/invoicing";
import { formatEuros } from "@/server/pricing";
import { zonedParts } from "@/server/time";

/** Vérifie §24, la fidélité et les automatisations contre la vraie base. */

const ok = (l: string) => console.info(`  ✓ ${l}`);
const ko = (l: string) => {
  console.error(`  ✗ ${l}`);
  process.exitCode = 1;
};
const check = (c: boolean, l: string) => (c ? ok(l) : ko(l));

async function main() {
  // ── Automatisations ──────────────────────────────────────────────────────
  console.info("\nAutomatisations");

  const first = await runJobByName("offres-expirees", { force: true });
  check(first.status === "SUCCESS", "une tâche forcée s'exécute et laisse une trace");

  const throttled = await runJobByName("offres-expirees");
  check(
    throttled.status === "SKIPPED",
    `relancée hors intervalle, elle est ignorée : « ${throttled.status === "SKIPPED" ? throttled.reason : ""} »`,
  );

  const status = await getJobStatus();
  check(status.length >= 6, `${status.length} tâches déclarées`);
  check(
    status.every((job) => job.description.length > 20),
    "chaque tâche explique ce qu'elle fait",
  );

  const unknown = await runJobByName("tache-inexistante");
  check(unknown.status === "SKIPPED", "une tâche inconnue est refusée sans planter");

  // ── Fidélité ─────────────────────────────────────────────────────────────
  console.info("\nFidélité");

  const original = await getLoyaltyRule();
  check(!original.enabled, "le programme est désactivé par défaut — c'est une décision commerciale");

  // Seuil à 1 lavage pour rendre le mécanisme observable sur le jeu de données.
  await saveLoyaltyRule(
    { enabled: true, everyNWashes: 1, kind: "DISCOUNT_PERCENT", value: 30, validityDays: 180 },
    null,
  );

  const granted = await runJobByName("fidelite", { force: true });
  const count = granted.status === "SUCCESS" ? Number(granted.summary.attribuées ?? 0) : 0;
  check(count > 0, `${count} récompense(s) attribuée(s)`);

  const again = await runJobByName("fidelite", { force: true });
  const secondPass = again.status === "SUCCESS" ? Number(again.summary.attribuées ?? 0) : -1;
  check(secondPass === 0, "relancer la tâche n'attribue jamais deux fois la même récompense");

  const rewarded = await prisma.customerReward.findFirst({
    where: { usedAt: null },
    select: { customerId: true },
  });

  if (rewarded) {
    const reward = await getAvailableReward(rewarded.customerId);
    check(reward !== null, "la récompense est disponible pour le prochain rendez-vous");
    if (reward) {
      const discount = rewardDiscountCents(reward, 8500);
      check(discount === 2550, `sur 85,00 €, la remise vaut ${formatEuros(discount)}`);
      check(
        rewardDiscountCents({ ...reward, kind: "FREE_SERVICE", value: 5000 }, 8500) === 5000,
        "une prestation offerte reste plafonnée à sa valeur",
      );
    }
  }

  await saveLoyaltyRule(original, null);
  ok("règle d'origine restaurée");

  // ── §24 — comptes entreprise et facturation ──────────────────────────────
  console.info("\n§24 · Comptes entreprise");

  const fleets = await getFleetAccounts();
  check(fleets.length > 0, `${fleets.length} compte(s) entreprise suivi(s)`);

  for (const fleet of fleets) {
    console.info(
      `      · ${fleet.companyName} — ${fleet.vehicleCount} véhicules, ` +
        `${fleet.contactCount} responsables, ${fleet.washesThisYear} lavages, ` +
        `${formatEuros(fleet.revenueYearCents)}`,
    );
  }

  const fleet = fleets[0];
  if (fleet) {
    const { year, month } = zonedParts(new Date());
    const preview = await previewInvoice(fleet.id, year, month);
    check(preview !== null, `facture de ${String(month).padStart(2, "0")}/${year} préparée`);

    if (preview && preview.lines.length > 0) {
      check(
        preview.totalCents === preview.subtotalCents + preview.vatCents,
        `TTC ${formatEuros(preview.totalCents)} = HT ${formatEuros(preview.subtotalCents)} + TVA ${formatEuros(preview.vatCents)}`,
      );

      const issued = await issueInvoice({
        customerId: fleet.id,
        year,
        month,
        actor: { userId: null, label: "Vérification" },
      });
      check(issued.ok, `facture ${issued.ok ? issued.number : "—"} émise`);

      const twice = await issueInvoice({
        customerId: fleet.id, year, month,
        actor: { userId: null, label: "Vérification" },
      });
      check(!twice.ok, "une seconde facture sur la même période est refusée");

      const after = await previewInvoice(fleet.id, year, month);
      check(
        after?.lines.length === 0,
        "les prestations facturées ne réapparaissent pas dans la préparation suivante",
      );
    } else {
      ok("aucune prestation à facturer sur la période courante");
    }
  }

  // ── Multi-régions ────────────────────────────────────────────────────────
  console.info("\nMulti-régions");

  const regions = await prisma.region.findMany({
    include: { _count: { select: { sectors: true } } },
  });
  check(regions.length > 0, `${regions.length} région(s), ${regions[0]?._count.sectors ?? 0} secteurs rattachés`);

  const orphans = await prisma.sector.count({ where: { regionId: null } });
  check(orphans === 0, "aucun secteur orphelin");

  await prisma.$disconnect();
}

main();
