import type { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { OPTION_DEFS, priceGrid, SERVICE_DEFS, TARIFS } from "../tarifs";
import { startOfLocalDay } from "@/server/time";
import { DAILY_SLOT_MINUTES, DEFAULT_ASSIGNMENT_SETTINGS } from "@/server/assignment/types";
import { DEFAULT_QUOTING, depositFor } from "@/server/quoting";
import { VEHICLE_MODELS } from "./vehicles";
import { placeholderPhoto, placeholderSignature } from "./placeholder-image";
import { storageProvider } from "@/lib/providers/storage";
import { issueJobInvoice } from "@/server/job-invoice";
import { REQUIRED_SLOTS } from "@/server/workflow/types";
import type { VehicleClass } from "@/generated/prisma/enums";

/**
 * Jeu de données de développement — réseau lyonnais.
 *
 * Objectif : que le moteur d'affectation ait de vraies tournées à analyser dès le premier
 * lancement. Les coordonnées sont réelles, les temps de trajet entre secteurs sont donc
 * réalistes.
 */

/**
 * Le client est injecté par l'appelant.
 *
 * Ce module sert deux usages : le script `db:seed`, qui ouvre sa propre connexion, et la
 * remise à zéro de la démonstration, qui réutilise celle de l'application. Une variable
 * de module suffit car une génération n'est jamais concurrente d'une autre — la remise à
 * zéro est sérialisée côté appelant.
 */
let prisma: PrismaClient;

export type SeedSummary = Record<string, string | number>;

export async function seedDataset(client: PrismaClient): Promise<SeedSummary> {
  prisma = client;
  return main();
}

const EUR = (n: number) => Math.round(n * 100);

/**
 * Avis du jeu de démonstration.
 *
 * Écrits comme parlent de vrais clients : un fait, une hésitation levée, parfois une
 * réserve. Six fois la même phrase — ce qu'il y avait ici — donne à un mur d'avis
 * l'aspect exact d'un mur d'avis fabriqué.
 */
const REVIEW_COMMENTS = [
  "Les sièges avaient deux taches de café que je pensais définitives. Elles sont parties.",
  "Il est arrivé à l'heure, il a travaillé sur mon parking d'entreprise, je n'ai rien eu à faire.",
  "J'ai eu les photos avant et après sur mon téléphone. C'est la première fois qu'on me montre ça.",
  "Trois ans de poils de chien dans le coffre. Il a fallu le temps annoncé, mais c'est propre.",
  "Prix annoncé, prix payé. Pas de supplément découvert à la fin.",
  "Bon travail sur l'intérieur. L'extérieur, j'aurais aimé un peu plus de soin sur les jantes.",
  "Ma voiture est partie en reprise la semaine suivante, le concessionnaire a relevé l'état.",
  "Rapide à réserver, créneau tenu, résultat conforme. Rien à redire.",
];

/**
 * Un créneau relatif à aujourd'hui, en heure locale.
 *
 * Le calendrier est ancré sur le jour où l'on ouvre l'application, et non sur le lundi de
 * la semaine : une démonstration consultée un samedi doit montrer une tournée vivante, pas
 * une semaine déjà passée. Les décalages négatifs constituent l'historique dont vivent les
 * statistiques (§25) et les reversements (§38).
 */
function slot(dayOffset: number, hour: number, minute = 0): Date {
  const midnight = startOfLocalDay(new Date());
  const day = new Date(midnight.getTime() + dayOffset * 24 * 3600_000);
  return new Date(day.getTime() + (hour * 60 + minute) * 60_000);
}

/** Le n-ième départ du jour (0 → 8 h 30, 1 → 11 h 30, 2 → 15 h 00). */
function departure(dayOffset: number, index: number): Date {
  const midnight = startOfLocalDay(new Date());
  const day = new Date(midnight.getTime() + dayOffset * 24 * 3600_000);
  return new Date(day.getTime() + DAILY_SLOT_MINUTES[index] * 60_000);
}

/**
 * Horaires d'un opérateur, du lundi au samedi.
 *
 * L'amplitude découle des trois départs : 8 h 30, 11 h 30 et 15 h, pour des prestations
 * de 1 h 10 à 3 h. La dernière peut donc finir à 18 h, ce qui fixe la fermeture à 18 h 30
 * — samedi compris, puisque la grille ne change pas selon le jour.
 *
 * Pas de pause déclarée au milieu de la journée : une coupure 12 h 30–13 h 30 rendrait
 * le départ de 11 h 30 impossible, toute prestation le chevauchant. La respiration est
 * entre les tournées — l'arrivée de la deuxième et le départ de la troisième laissent
 * une demi-heure.
 */
const FULL_WEEK = [1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startMinute: 8 * 60,
  endMinute: 18 * 60 + 30,
  breakStartMinute: null,
  breakEndMinute: null,
}));

/** Vide la base. Exporté pour les scripts de vérification, qui doivent pouvoir partir de rien. */
export async function wipeDataset(client: PrismaClient): Promise<void> {
  prisma = client;
  return reset();
}

async function reset() {
  // Ordre inverse des dépendances.
  await prisma.$transaction([
    prisma.storedFile.deleteMany(),
    prisma.trackingPing.deleteMany(),
    prisma.weatherCheck.deleteMany(),
    prisma.photo.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.commission.deleteMany(),
    prisma.settlement.deleteMany(),
    prisma.review.deleteMany(),
    prisma.alert.deleteMany(),
    prisma.slotOffer.deleteMany(),
    prisma.jobInvoice.deleteMany(),
    prisma.voucher.deleteMany(),
    prisma.invoiceLine.deleteMany(),
    prisma.signature.deleteMany(),
    prisma.vehicleAdjustment.deleteMany(),
    prisma.photoAnalysisImage.deleteMany(),
    prisma.photoAnalysis.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.customerReward.deleteMany(),
    prisma.businessContact.deleteMany(),
    prisma.appointmentOption.deleteMany(),
    prisma.appointmentEvent.deleteMany(),
    prisma.assignmentRun.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.customerVehicle.deleteMany(),
    prisma.customerAddress.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.adSpend.deleteMany(),
    prisma.fleetMaintenanceLog.deleteMany(),
    prisma.fleetVehicle.deleteMany(),
    prisma.operatorWorkingHours.deleteMany(),
    prisma.operatorTimeOff.deleteMany(),
    prisma.operatorService.deleteMany(),
    prisma.operatorSectorCoverage.deleteMany(),
    prisma.operator.deleteMany(),
    prisma.serviceOptionLink.deleteMany(),
    prisma.serviceOption.deleteMany(),
    prisma.servicePricing.deleteMany(),
    prisma.service.deleteMany(),
    prisma.sector.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.geocodeCache.deleteMany(),
    prisma.jobRun.deleteMany(),
    prisma.vehicleModel.deleteMany(),
    prisma.setting.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // La région se supprime après les secteurs qui la référencent.
  await prisma.region.deleteMany();
}

async function main(): Promise<SeedSummary> {
  await reset();

  // ── Réglages réseau (§4, §6) ──────────────────────────────────────────────
  await prisma.setting.create({
    data: {
      key: "assignment",
      value: DEFAULT_ASSIGNMENT_SETTINGS,
      description: "Pondération et contraintes du moteur d'affectation (§4, §6, §39)",
    },
  });

  await prisma.setting.create({
    data: {
      key: "quoting",
      value: DEFAULT_QUOTING,
      description: "Acompte et règles de devis (§21)",
    },
  });

  // ── §16 — référentiel marque / modèle ─────────────────────────────────────
  await prisma.vehicleModel.createMany({ data: VEHICLE_MODELS });

  // ── Région (§37 phase 6) ──────────────────────────────────────────────────
  const region = await prisma.region.create({
    data: { code: "AURA", name: "Auvergne-Rhône-Alpes", timezone: "Europe/Paris" },
  });

  // ── Secteurs (§28) ────────────────────────────────────────────────────────
  const sectorData = [
    { code: "LY-N", name: "Lyon Nord", color: "#2563eb", centroidLat: 45.7945, centroidLng: 4.8446 },
    { code: "LY-S", name: "Lyon Sud", color: "#059669", centroidLat: 45.7148, centroidLng: 4.8063 },
    { code: "LY-E", name: "Lyon Est", color: "#d97706", centroidLat: 45.7665, centroidLng: 4.9065 },
    { code: "LY-O", name: "Lyon Ouest", color: "#7c3aed", centroidLat: 45.7757, centroidLng: 4.7802 },
  ];
  const sectors = Object.fromEntries(
    await Promise.all(
      sectorData.map(
        async (s) =>
          [s.code, await prisma.sector.create({ data: { ...s, regionId: region.id } })] as const,
      ),
    ),
  );

  // ── Catalogue (§2) ────────────────────────────────────────────────────────
  // Deux formules seulement : l'intérieur, et l'intérieur plus l'extérieur. Vendre
  // aussi les moitiés séparément obligeait le client à comparer quatre lignes pour
  // comprendre une offre qui n'en compte que deux (§17).
  //
  // La grille tarifaire vit dans `server/tarifs.ts`, que partage le script de mise à
  // jour : un prix se change à un seul endroit, et le site en ligne suit.
  const services = Object.fromEntries(
    await Promise.all(
      SERVICE_DEFS.map(async (def) => {
        const service = await prisma.service.create({
          data: {
            ...def,
            pricing: {
              create: priceGrid(def.code),
            },
          },
        });
        return [def.code, service] as const;
      }),
    ),
  );

  const options = await Promise.all(
    OPTION_DEFS.map((o, i) => prisma.serviceOption.create({ data: { ...o, sortOrder: i } })),
  );

  for (const option of options) {
    // Le traitement des jantes n'a de sens que là où la carrosserie est lavée.
    const applicable =
      option.code === "OPT-JANTES"
        ? ["PACK-LUXE"]
        : ["PACK-CONCESSION", "PACK-LUXE"];
    await prisma.serviceOptionLink.createMany({
      data: applicable.map((code) => ({ serviceId: services[code].id, optionId: option.id })),
    });
  }

  // ── Comptes ───────────────────────────────────────────────────────────────
  const password = await hashPassword("xdetailing");

  await prisma.user.create({
    data: {
      email: "patron@xdetailing.fr", passwordHash: password, role: "ADMIN",
      firstName: "Direction", lastName: "X Detailing", phone: "0600000000",
    },
  });
  await prisma.user.create({
    data: {
      email: "conseiller@xdetailing.fr", passwordHash: password, role: "DISPATCHER",
      firstName: "Camille", lastName: "Conseil", phone: "0600000001",
    },
  });

  // ── Opérateurs (§28) ──────────────────────────────────────────────────────
  const operatorDefs = [
    {
      code: "OP-01", firstName: "Mehdi", lastName: "Bensaïd", sector: "LY-N",
      address: "18 rue Hénon, 69004 Lyon", lat: 45.7793, lng: 4.8286,
      plate: "GA-118-XD", quality: 92, coverage: ["LY-N", "LY-E"],
    },
    {
      code: "OP-02", firstName: "Julien", lastName: "Marchand", sector: "LY-S",
      address: "5 rue de la République, 69600 Oullins", lat: 45.7143, lng: 4.8085,
      plate: "GA-229-XD", quality: 85, coverage: ["LY-S", "LY-O"],
    },
    {
      code: "OP-03", firstName: "Sofiane", lastName: "Lemoine", sector: "LY-E",
      address: "42 cours Émile Zola, 69100 Villeurbanne", lat: 45.7679, lng: 4.8807,
      plate: "GA-337-XD", quality: 78, coverage: ["LY-E", "LY-N"],
    },
    {
      code: "OP-04", firstName: "Thomas", lastName: "Rivière", sector: "LY-O",
      address: "9 avenue Guy de Collongue, 69130 Écully", lat: 45.7833, lng: 4.7700,
      plate: "GA-445-XD", quality: 88, coverage: ["LY-O", "LY-S"],
    },
    {
      code: "OP-05", firstName: "Karim", lastName: "Dubois", sector: "LY-N",
      address: "24 rue de Sèze, 69006 Lyon", lat: 45.7695, lng: 4.8523,
      plate: "GA-552-XD", quality: 81, coverage: ["LY-N", "LY-E", "LY-O"],
      status: "ONBOARDING" as const,
    },
  ];

  const operators = [];
  for (const def of operatorDefs) {
    const user = await prisma.user.create({
      data: {
        email: `${def.firstName.toLowerCase()}@xdetailing.fr`,
        passwordHash: password, role: "OPERATOR",
        firstName: def.firstName, lastName: def.lastName,
        phone: `06${def.code.slice(-2)}112233`,
      },
    });

    const operator = await prisma.operator.create({
      data: {
        userId: user.id, code: def.code,
        firstName: def.firstName, lastName: def.lastName,
        phone: user.phone!, email: user.email,
        homeAddress: def.address, homeLat: def.lat, homeLng: def.lng,
        homeSectorId: sectors[def.sector].id,
        status: def.status ?? "ACTIVE",
        qualityScore: def.quality,
        workingHours: { create: FULL_WEEK },
        coverage: { create: def.coverage.map((c) => ({ sectorId: sectors[c].id })) },
        services: { create: Object.values(services).map((s) => ({ serviceId: s.id })) },
      },
    });

    await prisma.fleetVehicle.create({
      data: {
        plate: def.plate, year: 2024, mileageKm: 12_000 + Math.round(Math.random() * 30_000),
        insurancePolicy: `AXA-${def.code}`, insuranceExpiresAt: slot(300, 12),
        financingType: "LOA", monthlyCostCents: EUR(389),
        nextMaintenanceKm: 45_000, status: "ASSIGNED", operatorId: operator.id,
      },
    });

    operators.push(operator);
  }

  // ── Clients (§23, §24) ────────────────────────────────────────────────────
  const customerDefs = [
    { firstName: "Claire", lastName: "Fontaine", phone: "0611223344", line1: "12 rue Duquesne", postalCode: "69006", city: "Lyon", lat: 45.7702, lng: 4.8497, vehicle: "SUV" as VehicleClass, make: "Peugeot", model: "3008", flexible: true },
    { firstName: "Marc", lastName: "Delcourt", phone: "0622334455", line1: "34 rue Garibaldi", postalCode: "69007", city: "Lyon", lat: 45.7481, lng: 4.8447, vehicle: "BERLINE" as VehicleClass, make: "BMW", model: "Série 3" },
    { firstName: "Sophie", lastName: "Nguyen", phone: "0633445566", line1: "8 rue Louis Becker", postalCode: "69100", city: "Villeurbanne", lat: 45.7699, lng: 4.8734, vehicle: "CITADINE" as VehicleClass, make: "Renault", model: "Clio", flexible: true },
    { firstName: "Antoine", lastName: "Perrin", phone: "0644556677", line1: "3 place Général Leclerc", godMode: false, postalCode: "69600", city: "Oullins", lat: 45.7166, lng: 4.8074, vehicle: "BREAK" as VehicleClass, make: "Volkswagen", model: "Passat SW" },
    { firstName: "Nadia", lastName: "Bouchard", phone: "0655667788", line1: "22 avenue Édouard Aynard", postalCode: "69130", city: "Écully", lat: 45.7761, lng: 4.7787, vehicle: "QUATRE_X_QUATRE" as VehicleClass, make: "Land Rover", model: "Discovery" },
    { firstName: "Hugo", lastName: "Lambert", phone: "0666778899", line1: "15 rue Masséna", postalCode: "69006", city: "Lyon", lat: 45.7680, lng: 4.8462, vehicle: "CITADINE" as VehicleClass, make: "Toyota", model: "Yaris" },
    { firstName: "Élodie", lastName: "Garnier", phone: "0677889900", line1: "60 cours Tolstoï", postalCode: "69100", city: "Villeurbanne", lat: 45.7663, lng: 4.8792, vehicle: "SEPT_PLACES" as VehicleClass, make: "Citroën", model: "Grand C4", flexible: true },
  ];

  const customers = [];
  for (const def of customerDefs) {
    const customer = await prisma.customer.create({
      data: {
        firstName: def.firstName, lastName: def.lastName,
        phone: def.phone, email: `${def.firstName.toLowerCase()}.${def.lastName.toLowerCase()}@example.fr`,
        flexible: def.flexible ?? false, marketingOptIn: true,
        addresses: {
          create: {
            label: "Domicile", line1: def.line1, postalCode: def.postalCode, city: def.city,
            lat: def.lat, lng: def.lng, isDefault: true,
          },
        },
        vehicles: {
          create: { vehicleClass: def.vehicle, make: def.make, model: def.model },
        },
      },
      include: { addresses: true, vehicles: true },
    });
    customers.push(customer);
  }

  // Compte professionnel (§24)
  const fleet = await prisma.customer.create({
    data: {
      type: "BUSINESS", companyName: "Cabinet Vallier & Associés", siret: "84312765400018",
      phone: "0478000000", email: "flotte@vallier.fr", marketingOptIn: false,
      addresses: {
        create: {
          label: "Siège", line1: "120 rue Vendôme", postalCode: "69003", city: "Lyon",
          lat: 45.7627, lng: 4.8496, isDefault: true, accessNotes: "Parking sous-sol, badge à l'accueil",
        },
      },
      vehicles: {
        create: [
          { vehicleClass: "BERLINE", make: "Audi", model: "A4", plate: "EX-101-AB" },
          { vehicleClass: "BERLINE", make: "Audi", model: "A6", plate: "EX-102-AB" },
          { vehicleClass: "SUV", make: "Volvo", model: "XC60", plate: "EX-103-AB" },
        ],
      },
      // §24 — un compte entreprise a plusieurs interlocuteurs : celui qui organise,
      // et celui qui paie.
      contacts: {
        create: [
          {
            firstName: "Laurence", lastName: "Vallier", role: "Associée gérante",
            email: "l.vallier@vallier.fr", phone: "0478000001",
          },
          {
            firstName: "Bruno", lastName: "Petit", role: "Comptabilité",
            email: "compta@vallier.fr", phone: "0478000002", billing: true,
          },
        ],
      },
    },
    include: { addresses: true, vehicles: true },
  });
  customers.push(fleet);

  // ── Leads Meta (§19) ──────────────────────────────────────────────────────
  await prisma.lead.createMany({
    data: [
      { source: "META", externalId: "lead_8891", campaign: "Lavage à domicile Lyon", adset: "Lyon 6e", ad: "Vidéo avant/après", costCents: EUR(9.4), fullName: "Claire Fontaine", phone: "0611223344", city: "Lyon", status: "BOOKED" },
      { source: "META", externalId: "lead_8907", campaign: "Lavage à domicile Lyon", adset: "Villeurbanne", ad: "Carrousel tarifs", costCents: EUR(11.2), fullName: "Paul Vasseur", phone: "0688990011", city: "Villeurbanne", status: "NEW" },
      { source: "META", externalId: "lead_8912", campaign: "Entreprises & flottes", adset: "Lyon 3e", ad: "Offre flotte", costCents: EUR(18.6), fullName: "Service généraux Vallier", phone: "0478000000", city: "Lyon", status: "CONTACTED" },
    ],
  });

  // ── Tournées de la semaine ────────────────────────────────────────────────
  // Charge volontairement déséquilibrée : OP-01 chargé, OP-03 quasi vide. Le moteur
  // doit rattraper l'écart sur les prochaines affectations (§5).
  const plan: Array<{
    op: number; customer: number; day: number;
    /** Index du départ dans `DAILY_SLOT_MINUTES` : 0, 1 ou 2. */
    slot: number;
    service: keyof typeof TARIFS; status?: string;
  }> = [
    // Les semaines passées : de quoi alimenter les statistiques et une quinzaine complète.
    // Deux clients laissés sans nouvelle depuis plus d'un mois : ce sont eux que la
    // relance d'entretien doit rattraper, bon de remise à l'appui (§23).
    { op: 0, customer: 0, day: -45, slot: 0, service: "PACK-CONCESSION", status: "COMPLETED" },
    { op: 1, customer: 5, day: -38, slot: 2, service: "PACK-LUXE", status: "COMPLETED" },
    { op: 1, customer: 3, day: -8, slot: 1, service: "PACK-CONCESSION", status: "COMPLETED" },
    { op: 2, customer: 2, day: -8, slot: 2, service: "PACK-LUXE", status: "COMPLETED" },
    { op: 3, customer: 4, day: -6, slot: 0, service: "PACK-CONCESSION", status: "COMPLETED" },
    { op: 0, customer: 1, day: -3, slot: 1, service: "PACK-LUXE", status: "COMPLETED" },
    { op: 1, customer: 4, day: -2, slot: 2, service: "PACK-CONCESSION", status: "COMPLETED" },
    { op: 2, customer: 6, day: -1, slot: 0, service: "PACK-LUXE", status: "COMPLETED" },
    { op: 3, customer: 7, day: -1, slot: 2, service: "PACK-CONCESSION", status: "COMPLETED" },

    // Aujourd'hui : le départ de 8 h 30 est fait, ceux de 11 h 30 et 15 h restent à faire.
    // Le dernier reste démarrable toute la soirée — la garde ne bloque que l'avance,
    // jamais le retard —, ce qui garde la démonstration praticable à toute heure.
    { op: 0, customer: 1, day: 0, slot: 0, service: "PACK-CONCESSION", status: "COMPLETED" },
    { op: 1, customer: 3, day: 0, slot: 1, service: "PACK-CONCESSION", status: "CONFIRMED" },
    { op: 2, customer: 6, day: 0, slot: 1, service: "PACK-LUXE", status: "CONFIRMED" },
    { op: 0, customer: 2, day: 0, slot: 2, service: "PACK-LUXE", status: "CONFIRMED" },

    // Les jours qui viennent : le planning a de quoi se remplir et se réorganiser.
    { op: 0, customer: 4, day: 1, slot: 0, service: "PACK-CONCESSION", status: "CONFIRMED" },
    { op: 3, customer: 7, day: 1, slot: 1, service: "PACK-CONCESSION", status: "CONFIRMED" },
    { op: 0, customer: 6, day: 1, slot: 2, service: "PACK-CONCESSION", status: "CONFIRMED" },
    { op: 1, customer: 3, day: 2, slot: 0, service: "PACK-LUXE", status: "CONFIRMED" },
    { op: 2, customer: 6, day: 2, slot: 2, service: "PACK-CONCESSION", status: "CONFIRMED" },
    { op: 3, customer: 7, day: 3, slot: 1, service: "PACK-CONCESSION", status: "CONFIRMED" },
  ];

  let counter = 1;
  for (const row of plan) {
    const operator = operators[row.op];
    const customer = customers[row.customer];
    const address = customer.addresses[0];
    const vehicle = customer.vehicles[0];
    const service = services[row.service];
    const { priceCents, durationMin } = TARIFS[row.service];
    const start = departure(row.day, row.slot);
    const sectorCode = operatorDefs[row.op].sector;

    const appointment = await prisma.appointment.create({
      data: {
        reference: `XD-2609-${String(counter++).padStart(4, "0")}`,
        customerId: customer.id, customerVehicleId: vehicle.id, addressId: address.id,
        addressLine1: address.line1, postalCode: address.postalCode, city: address.city,
        lat: address.lat, lng: address.lng, accessNotes: address.accessNotes,
        serviceId: service.id, vehicleClass: vehicle.vehicleClass,
        operatorId: operator.id, sectorId: sectors[sectorCode].id,
        status: (row.status ?? "CONFIRMED") as never,
        source: counter % 3 === 0 ? "PHONE" : "WEB",
        scheduledStart: start,
        scheduledEnd: new Date(start.getTime() + durationMin * 60_000),
        durationMin, priceCents, totalCents: priceCents,
        depositCents: depositFor(priceCents, DEFAULT_QUOTING),
        // Accord de publication : donné par les clients fictifs, pour que les pages
        // réalisation aient de quoi montrer. En production, seule la case cochée compte.
        publishable: row.status === "COMPLETED",
      },
    });

    await prisma.appointmentEvent.create({
      data: { appointmentId: appointment.id, type: "CREATED", at: new Date(start.getTime() - 3 * 24 * 3600_000) },
    });

    // Preuves de la prestation terminée : les huit angles à l'arrivée, les huit
    // mêmes au départ, et le bon signé. C'est ce que l'espace admin donne à lire —
    // sans ces lignes, le dossier d'un impayé (§36) et l'historique d'un véhicule
    // s'affichent vides.
    if (row.status === "COMPLETED") {
      const storage = storageProvider();
      const finishedAt = new Date(start.getTime() + durationMin * 60_000);

      for (const [phaseIndex, phase] of (["BEFORE", "AFTER"] as const).entries()) {
        const takenAt = phaseIndex === 0 ? start : finishedAt;

        for (const [slotIndex, slot] of REQUIRED_SLOTS.entries()) {
          const seed = counter * 8 + phaseIndex * 4 + slotIndex;
          const stored = await storage.put(placeholderPhoto(seed), {
            extension: "png",
            prefix: `demo/${appointment.reference}`,
          });

          await prisma.photo.create({
            data: {
              appointmentId: appointment.id,
              customerVehicleId: vehicle.id,
              phase, slot,
              path: stored.key,
              bytes: stored.bytes,
              width: 320, height: 240,
              hash: stored.sha256,
              takenAt: new Date(takenAt.getTime() + slotIndex * 60_000),
              exifTakenAt: new Date(takenAt.getTime() + slotIndex * 60_000),
              capturedInApp: true,
              lat: address.lat, lng: address.lng,
            },
          });
        }
      }

      await prisma.signature.create({
        data: {
          appointmentId: appointment.id,
          paths: placeholderSignature(counter),
          signerName: `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim()
            || customer.companyName || "Client",
          acknowledged: {
            reference: appointment.reference,
            service: service.name,
            vehicle: `${vehicle.make} ${vehicle.model}`,
            plate: vehicle.plate,
            totalCents: priceCents,
            depositCents: depositFor(priceCents, DEFAULT_QUOTING),
        // Accord de publication : donné par les clients fictifs, pour que les pages
        // réalisation aient de quoi montrer. En production, seule la case cochée compte.
        publishable: row.status === "COMPLETED",
            balanceCents: priceCents - depositFor(priceCents, DEFAULT_QUOTING),
          },
          signedAt: start,
        },
      });
    }

    if (row.status === "COMPLETED") {
      await prisma.payment.create({
        data: {
          appointmentId: appointment.id, kind: "FULL", method: counter % 2 ? "CARD_LINK" : "CASH",
          status: "PAID", beneficiary: "XDETAILING",
          amountCents: priceCents, receivedCents: priceCents,
          collectedByOperatorId: operator.id, paidAt: new Date(start.getTime() + durationMin * 60_000),
        },
      });
      await prisma.commission.create({
        data: {
          appointmentId: appointment.id, operatorId: operator.id,
          baseCents: priceCents, rate: 0.18, amountCents: Math.round(priceCents * 0.18),
          periodYear: start.getFullYear(), periodMonth: start.getMonth() + 1,
        },
      });
      await issueJobInvoice(appointment.id, prisma);

      await prisma.review.create({
        data: {
          appointmentId: appointment.id, customerId: customer.id, operatorId: operator.id,
          rating: 4 + (counter % 2), comment: REVIEW_COMMENTS[counter % REVIEW_COMMENTS.length],
        },
      });
    }
  }

  // ── Alertes ouvertes pour le tableau de bord (§27) ────────────────────────
  await prisma.alert.create({
    data: {
      type: "UNASSIGNED_APPOINTMENT", severity: "WARNING",
      title: "Lead Meta non rappelé",
      message: "Paul Vasseur (Villeurbanne) attend un rappel depuis 2 jours.",
    },
  });

  const counts = {
    région: region.name,
    secteurs: sectorData.length,
    opérateurs: operators.length,
    prestations: SERVICE_DEFS.length,
    "modèles véhicules": VEHICLE_MODELS.length,
    options: options.length,
    clients: customers.length,
    "rendez-vous": plan.length,
  };
  return counts;
}
