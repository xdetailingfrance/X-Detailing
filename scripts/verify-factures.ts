import "dotenv/config";
import { prisma } from "@/server/db";
import { getJobInvoice, issueJobInvoice } from "@/server/job-invoice";

/** Vérifie que chaque prestation terminée a sa facture, et une seule. */
async function main() {
  const done = await prisma.appointment.findMany({
    where: { status: "COMPLETED" },
    select: { id: true, reference: true, totalCents: true, publicToken: true },
    orderBy: { reference: "asc" },
  });

  console.info("§24 · Facture par prestation\n");

  for (const job of done) {
    const invoice = await getJobInvoice(job.id);
    if (!invoice) {
      console.info(`  ${job.reference}  AUCUNE FACTURE`);
      continue;
    }
    console.info(
      `  ${job.reference}  ${invoice.number}  ${invoice.formatted.total}` +
        `  (HT ${invoice.formatted.subtotal} + TVA ${invoice.formatted.vat})`,
    );
  }

  // Idempotence : réémettre ne doit pas créer un second document.
  const first = done[0];
  const before = await prisma.jobInvoice.count();
  const again = await issueJobInvoice(first.id);
  const after = await prisma.jobInvoice.count();
  console.info(
    `\n  Réémission de ${first.reference} → ${again.ok ? again.number : again.error}` +
      ` · documents ${before} → ${after}${before === after ? " (idempotent ✓)" : " (DOUBLON ✗)"}`,
  );

  console.info(`\n  Facture client : /reservation/${first.publicToken}/facture`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
