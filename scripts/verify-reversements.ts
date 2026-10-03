import "dotenv/config";
import { prisma } from "@/server/db";
import { fortnightOf, prepareSettlement, issueSettlement, markSettlementPaid } from "@/server/settlements";
import { formatEuros } from "@/server/pricing";

/** §38 point 5 — X Detailing encaisse, puis reverse à la quinzaine. */

const ok = (l: string) => console.info(`  ✓ ${l}`);
const ko = (l: string) => {
  console.error(`  ✗ ${l}`);
  process.exitCode = 1;
};
const check = (c: boolean, l: string) => (c ? ok(l) : ko(l));

async function main() {
  const done = await prisma.appointment.findFirst({
    where: { status: "COMPLETED", finishedAt: { not: null } },
    orderBy: { finishedAt: "desc" },
    select: { operatorId: true, finishedAt: true },
  });

  if (!done?.operatorId || !done.finishedAt) {
    console.info("Aucune prestation terminée — lancez `npm run verify:workflow`.");
    return;
  }

  const period = fortnightOf(done.finishedAt);
  console.info(`\nQuinzaine du ${period.label}\n`);

  const draft = await prepareSettlement(done.operatorId, period);
  if (!draft) return;

  console.info(`  ${draft.operatorName} — ${draft.jobCount} prestation(s)`);
  console.info(`      CA produit            ${formatEuros(draft.totalRevenueCents).padStart(10)}`);
  console.info(`      commission ${(draft.commissionRate * 100).toFixed(0)} %        −${formatEuros(draft.commissionCents).padStart(9)}`);
  console.info(`      publicité             −${formatEuros(draft.adContributionCents).padStart(9)}`);
  console.info(`      net gagné             ${formatEuros(draft.netCents).padStart(10)}`);
  console.info(`      espèces détenues      −${formatEuros(draft.cashHeldCents).padStart(9)}`);
  console.info(`      à virer               ${formatEuros(draft.payoutCents).padStart(10)}\n`);

  check(
    draft.netCents === draft.totalRevenueCents - draft.commissionCents - draft.adContributionCents,
    "net gagné = CA − commission − publicité",
  );
  check(
    draft.payoutCents === draft.netCents - draft.cashHeldCents,
    "virement = net gagné − espèces déjà détenues",
  );

  // §38 point 5 : X Detailing est l'encaisseur de référence, y compris en espèces.
  const cashToOperator = await prisma.payment.count({
    where: { method: "CASH", beneficiary: "OPERATOR" },
  });
  check(cashToOperator === 0, "aucun encaissement n'est attribué à l'opérateur");

  if (draft.existingId) {
    ok("un reversement existe déjà pour cette quinzaine");
    return;
  }

  const issued = await issueSettlement({
    operatorId: done.operatorId,
    period,
    actor: { userId: null, label: "Vérification" },
  });
  check(issued.ok, `reversement ${issued.ok ? issued.reference : "—"} émis`);

  const twice = await issueSettlement({
    operatorId: done.operatorId,
    period,
    actor: { userId: null, label: "Vérification" },
  });
  check(!twice.ok, "un second reversement sur la même quinzaine est refusé");

  const after = await prepareSettlement(done.operatorId, period);
  check(after?.commissionCents === 0, "les commissions reversées ne sont plus reversables");

  if (issued.ok) {
    const paid = await markSettlementPaid({
      settlementId: issued.settlementId,
      paymentRef: "VIR-TEST-001",
      actor: { userId: null, label: "Vérification" },
    });
    check(paid.ok, "le virement est confirmé avec sa référence");

    const again = await markSettlementPaid({
      settlementId: issued.settlementId,
      actor: { userId: null, label: "Vérification" },
    });
    check(!again.ok, "un reversement déjà viré ne peut pas l'être deux fois");
  }

  await prisma.$disconnect();
}

main();
