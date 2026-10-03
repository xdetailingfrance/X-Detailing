import "dotenv/config";
import { prisma } from "@/server/db";
import { findAvailableSlots } from "@/server/assignment/availability";
import { startOfLocalDay } from "@/server/time";

/**
 * Contrôle de la grille : quels départs sont réellement proposables, jour par jour,
 * pour chaque formule. C'est le seul moyen de voir si un créneau disparaît à cause
 * d'une contrainte d'horaires plutôt que d'un planning chargé.
 */
async function main() {
  const services = await prisma.service.findMany({ orderBy: { sortOrder: "asc" } });
  const address = { lat: 45.764, lng: 4.8357, address: "Place Bellecour, Lyon" };
  const today = startOfLocalDay(new Date());

  for (const service of services) {
    const pricing = await prisma.servicePricing.findFirstOrThrow({
      where: { serviceId: service.id, vehicleClass: "BERLINE" },
    });
    console.info(`\n${service.name} · berline · ${pricing.durationMin} min`);

    for (let offset = 1; offset <= 6; offset++) {
      const day = new Date(today.getTime() + offset * 24 * 3600_000);
      const result = await findAvailableSlots({
        ...address,
        day,
        durationMin: pricing.durationMin,
        serviceId: service.id,
      });
      const labels = result.slots.map((s) => s.label).join(" · ") || "aucun";
      const name = day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" });
      console.info(`  ${name.padEnd(22)} ${labels}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
