import { prisma } from "@/server/db";
import { hashPassword } from "@/lib/auth/password";
import { findAvailableSlots } from "@/server/assignment/availability";
import { geoProvider } from "@/lib/providers/geo";
import { DAILY_SLOT_MINUTES, slotLabel } from "@/server/assignment/types";
import { startOfLocalDay } from "@/server/time";

/**
 * Une installation neuve peut-elle prendre une réservation ?
 *
 * La question n'est pas théorique : la base de production a tourné des jours avec un
 * catalogue vide, puis sans territoire — et sans secteur, le back-office refuse de
 * créer le moindre opérateur, ce qui ferme la chaîne définitivement.
 *
 * Ce script monte le cas minimal — territoire, catalogue, un opérateur — et vérifie
 * que les trois départs ressortent. Il écrit : à ne lancer que sur une base jetable.
 *
 *     DATABASE_URL="postgres://…" npx tsx scripts/verify-installation.ts
 */

async function main(): Promise<void> {
  const sector = await prisma.sector.findFirst({ where: { active: true } });
  if (!sector) throw new Error("Aucun secteur : lancez d'abord scripts/catalogue.ts --appliquer");

  const service = await prisma.service.findFirst({ where: { active: true }, include: { pricing: true } });
  if (!service) throw new Error("Aucune prestation : lancez d'abord scripts/catalogue.ts --appliquer");

  const durationMin = service.pricing[0]?.durationMin ?? 120;
  console.log(`Secteur    ${sector.code} · ${sector.name}`);
  console.log(`Prestation ${service.name} · ${durationMin} min`);

  // Un opérateur, tel que le back-office le créerait : pas de pause déclarée.
  let operator = await prisma.operator.findFirst({ where: { status: "ACTIVE" } });
  if (!operator) {
    const user = await prisma.user.create({
      data: {
        email: "verification@xdetailing.test",
        passwordHash: await hashPassword("verification"),
        role: "OPERATOR", firstName: "Vérification", lastName: "Installation",
        phone: "0600000000",
      },
    });
    operator = await prisma.operator.create({
      data: {
        userId: user.id, code: "OP-TEST",
        firstName: user.firstName, lastName: user.lastName,
        phone: user.phone!, email: user.email,
        homeAddress: sector.name, homeLat: sector.centroidLat, homeLng: sector.centroidLng,
        homeSectorId: sector.id, status: "ACTIVE",
        workingHours: {
          create: [1, 2, 3, 4, 5, 6].map((weekday) => ({
            weekday, startMinute: 8 * 60, endMinute: 18 * 60 + 30,
            breakStartMinute: null, breakEndMinute: null,
          })),
        },
        coverage: { create: [{ sectorId: sector.id }] },
        services: { create: [{ serviceId: service.id }] },
      },
    });
    console.log(`Opérateur  ${operator.code} créé`);
  }

  const location = await geoProvider().geocode("12 rue Sainte-Catherine, 33000 Bordeaux");
  if (!location) throw new Error("Géocodage impossible : l'adresse n'a pas été reconnue");
  console.log(`Adresse    ${location.formatted}`);

  /*
   * On cherche le premier jour ouvré à venir, pas « demain ».
   *
   * Lancé un samedi, un test fixé à demain interroge un dimanche, où personne ne
   * travaille : il conclut à zéro créneau et accuse le code d'un défaut qui n'existe
   * pas. Une vérification qui dépend du jour où on la lance ne vérifie rien.
   */
  let availability = null;
  let day = startOfLocalDay(new Date());
  for (let offset = 1; offset <= 7; offset += 1) {
    day = startOfLocalDay(new Date(Date.now() + offset * 24 * 3600_000));
    const result = await findAvailableSlots({
      lat: location.lat, lng: location.lng, address: location.formatted,
      day, durationMin, serviceId: service.id,
    });
    if (result.slots.length > 0) {
      availability = result;
      break;
    }
    availability ??= result;
    if (result.operatorsConsidered === 0) break;
  }

  console.log(`Jour testé ${day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`);
  if (!availability) throw new Error("Aucune disponibilité calculée");

  console.log(`\nOpérateurs examinés : ${availability.operatorsConsidered}`);
  console.log(`Créneaux proposés   : ${availability.slots.length}`);
  for (const slot of availability.slots) {
    console.log(`  ${new Date(slot.start).toLocaleString("fr-FR")}`);
  }

  /*
   * La comparaison se fait sur les minutes, pas sur des libellés formatés : les deux
   * côtés n'écrivent pas l'heure pareil, et une comparaison de chaînes déclarait les
   * trois départs manquants alors que deux étaient bien là.
   */
  const obtenus = new Set(
    availability.slots.map((s) => {
      const d = new Date(s.start);
      return d.getHours() * 60 + d.getMinutes();
    }),
  );
  const manquants = DAILY_SLOT_MINUTES.filter((minute) => !obtenus.has(minute));

  console.log(`\nDéparts attendus : ${DAILY_SLOT_MINUTES.map(slotLabel).join(" · ")}`);
  if (manquants.length === 0) {
    console.log("Les trois départs sont proposés.");
    return;
  }

  console.log(`MANQUANTS : ${manquants.map(slotLabel).join(" · ")}`);
  console.log(
    "\nUn départ manquant n'est pas forcément un défaut : l'opérateur doit pouvoir\n" +
      "rejoindre l'adresse depuis son point de départ sans entamer sa journée avant\n" +
      "l'heure déclarée. Pour un premier départ à 8 h 30 chez un client à 35 minutes,\n" +
      "la journée doit commencer au plus tard à 7 h 55.",
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
