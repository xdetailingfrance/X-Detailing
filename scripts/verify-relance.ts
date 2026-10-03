import "dotenv/config";
import { prisma } from "@/server/db";
import { runJobByName } from "@/server/jobs";
import { checkVoucher } from "@/server/vouchers";
import { FOLLOW_UP_AFTER_DAYS } from "@/server/notification-templates";

/**
 * Vérifie la chaîne de relance : un mois après un lavage, le client reçoit un code,
 * et ce code est réellement accepté par le tunnel de réservation.
 */
async function main() {
  console.info(`§23 · Relance à ${FOLLOW_UP_AFTER_DAYS} jours\n`);

  const outcome = await runJobByName("relances", { force: true });
  const detail =
    outcome.status === "SUCCESS" ? JSON.stringify(outcome.summary)
    : outcome.status === "FAILED" ? outcome.error
    : outcome.reason;
  console.info(`  tâche      ${outcome.status} · ${detail}`);

  const vouchers = await prisma.voucher.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { firstName: true, lastName: true, email: true } } },
  });

  if (vouchers.length === 0) {
    console.info("\n  Aucun bon émis — aucun client n'a atteint le délai de relance.");
    return;
  }

  for (const voucher of vouchers.slice(0, 5)) {
    const name = `${voucher.customer.firstName ?? ""} ${voucher.customer.lastName ?? ""}`.trim();
    console.info(`\n  ${voucher.code}  ${name} · −${voucher.percentOff} %`);
    console.info(`    expire le ${voucher.expiresAt.toISOString().slice(0, 10)}`);

    const onHundred = await checkVoucher(voucher.code, 13900, voucher.customer.email);
    console.info(
      onHundred.ok
        ? `    sur 139,00 € → remise de ${(onHundred.discountCents / 100).toFixed(2)} €`
        : `    REFUSÉ : ${onHundred.error}`,
    );

    const wrongOwner = await checkVoucher(voucher.code, 13900, "quelqu-un-dautre@example.fr");
    console.info(`    autre compte → ${wrongOwner.ok ? "ACCEPTÉ (anormal)" : wrongOwner.error}`);
  }

  const unknown = await checkVoucher("XDZZZZZ", 13900);
  console.info(`\n  code inventé → ${unknown.ok ? "ACCEPTÉ (anormal)" : unknown.error}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
