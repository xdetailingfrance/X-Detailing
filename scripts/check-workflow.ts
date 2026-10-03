import "dotenv/config";
import { prisma } from "@/server/db";
import { formatLocalDateTime } from "@/server/time";

/** Liste les prestations du jour par opérateur — utile pour tester la PWA. */
async function main() {
  const today = await prisma.appointment.findMany({
    where: { scheduledStart: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    orderBy: { scheduledStart: "asc" },
    take: 8,
    include: {
      operator: { select: { code: true, email: true, firstName: true } },
      customer: { select: { firstName: true, lastName: true } },
    },
  });

  for (const a of today) {
    console.info(
      `${a.reference}  ${formatLocalDateTime(a.scheduledStart)}  ${a.status.padEnd(12)}` +
        `  ${a.operator?.email ?? "—"}  ${a.customer.firstName} ${a.customer.lastName}  /pro/${a.id}`,
    );
  }
  await prisma.$disconnect();
}
main();
