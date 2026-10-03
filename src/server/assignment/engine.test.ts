import test from "node:test";
import assert from "node:assert/strict";

import type { GeoProvider, LatLng, TravelMatrix } from "@/lib/providers/geo";
import { findBestOperators } from "./engine";
import {
  DEFAULT_ASSIGNMENT_SETTINGS,
  type AssignmentRequest,
  type AssignmentSettings,
  type OperatorSnapshot,
} from "./types";

/**
 * Les six cas nommés par le cahier des charges (§4, §5, §6, §36, §39).
 *
 * Le fournisseur cartographique est remplacé par une table de temps explicite :
 * les assertions portent sur la logique d'affectation, pas sur un modèle de trajet.
 */

// 2026-06-15 est un lundi ; la France est en heure d'été (UTC+2).
const MONDAY = "2026-06-15";

function at(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(`${MONDAY}T${String(h - 2).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
}

const CLIENT: LatLng = { lat: 48.8566, lng: 2.3522 };

/** Chaque lieu est un point distinct ; les temps de trajet sont donnés explicitement. */
const place = (n: number): LatLng => ({ lat: 48 + n, lng: 2 + n });
const key = (a: LatLng, b: LatLng) => `${a.lat},${a.lng}>${b.lat},${b.lng}`;

function geoWith(times: Record<string, number>): GeoProvider {
  return {
    name: "test",
    trafficAware: false,
    async geocode() {
      return null;
    },
    async travelMatrix(origins, destinations): Promise<TravelMatrix> {
      return {
        provider: "test",
        trafficAware: false,
        legs: origins.map((o) =>
          destinations.map((d) => {
            const minutes = times[key(o, d)];
            assert.ok(minutes !== undefined, `temps de trajet manquant pour ${key(o, d)}`);
            return { minutes, km: minutes / 2 };
          }),
        ),
      };
    },
  };
}

const ALL_WEEK = [1].map((weekday) => ({
  weekday,
  startMinute: 8 * 60,
  endMinute: 19 * 60,
  breakStartMinute: 12 * 60 + 30,
  breakEndMinute: 13 * 60 + 30,
}));

function operator(over: Partial<OperatorSnapshot> & { id: string }): OperatorSnapshot {
  return {
    code: over.id,
    name: over.id,
    status: "ACTIVE",
    home: place(1),
    homeSectorId: "sector-1",
    sectorIds: ["sector-1"],
    serviceIds: ["svc-int-ext"],
    qualityScore: 80,
    targetJobsPerDay: 5,
    maxTravelMinOverride: null,
    workingHours: ALL_WEEK,
    timeOff: [],
    jobsOnDay: [],
    revenueTodayCents: 0,
    revenueWeekCents: 0,
    jobsWeekCount: 0,
    ...over,
  };
}

const REQUEST: AssignmentRequest = {
  address: "12 rue de Rivoli, 75001 Paris",
  lat: CLIENT.lat,
  lng: CLIENT.lng,
  start: at("14:00"),
  durationMin: 90,
  serviceId: "svc-int-ext",
  sectorId: "sector-1",
};

function run(
  operators: OperatorSnapshot[],
  times: Record<string, number>,
  settings: Partial<AssignmentSettings> = {},
  request: Partial<AssignmentRequest> = {},
) {
  return findBestOperators({
    request: { ...REQUEST, ...request },
    operators,
    settings: { ...DEFAULT_ASSIGNMENT_SETTINGS, ...settings },
    geo: geoWith(times),
  });
}

// ─── 1. Opérateur proche mais déjà occupé → éliminé (§4) ─────────────────────

test("un opérateur proche mais déjà occupé est éliminé", async () => {
  const busy = operator({
    id: "OP-A",
    home: place(1),
    jobsOnDay: [
      { id: "j1", start: at("13:30"), end: at("15:00"), ...place(1), label: "RDV Durand" },
    ],
  });
  const free = operator({ id: "OP-B", home: place(2) });

  const result = await run([busy, free], {
    [key(place(1), CLIENT)]: 5,
    [key(place(2), CLIENT)]: 20,
  });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].operatorId, "OP-B");

  const rejection = result.rejected.find((r) => r.operatorId === "OP-A");
  assert.equal(rejection?.reason, "OVERLAP");
  assert.match(rejection!.detail, /déjà occupé à 13:30/);
});

// ─── 2. Proche du domicile mais tournée infaisable → éliminé (§4, §6) ────────

test("la faisabilité se juge sur la tournée réelle, pas sur le domicile", async () => {
  // OP-A habite à 5 min du client, mais son RDV précédent se termine à 40 min de là.
  const tourneeImpossible = operator({
    id: "OP-A",
    home: place(1),
    jobsOnDay: [
      { id: "j1", start: at("12:00"), end: at("13:50"), ...place(9), label: "RDV Morel" },
    ],
  });
  const faisable = operator({ id: "OP-B", home: place(2) });

  const result = await run([tourneeImpossible, faisable], {
    [key(place(9), CLIENT)]: 40, // origine réelle de OP-A : son RDV précédent
    [key(place(2), CLIENT)]: 25,
  });

  const rejection = result.rejected.find((r) => r.operatorId === "OP-A");
  assert.equal(rejection?.reason, "INBOUND_TRAVEL");
  assert.match(rejection!.detail, /trajet impossible depuis le RDV de 13:50/);
  assert.equal(result.candidates[0].operatorId, "OP-B");
});

// ─── 3. Candidats comparables → le moins chargé gagne (§5) ───────────────────

test("à faisabilité comparable, l'opérateur au CA le plus faible l'emporte", async () => {
  const charge = operator({
    id: "OP-CHARGE",
    home: place(1),
    revenueWeekCents: 90_000,
    jobsOnDay: [
      { id: "a", start: at("08:30"), end: at("10:00"), ...place(1), label: "RDV 1" },
      { id: "b", start: at("10:30"), end: at("12:00"), ...place(1), label: "RDV 2" },
      { id: "c", start: at("16:00"), end: at("17:30"), ...place(1), label: "RDV 3" },
    ],
  });
  const disponible = operator({
    id: "OP-LIBRE",
    home: place(2),
    revenueWeekCents: 20_000,
    jobsOnDay: [
      { id: "d", start: at("09:00"), end: at("10:30"), ...place(2), label: "RDV 1" },
    ],
  });

  const result = await run([charge, disponible], {
    [key(place(1), CLIENT)]: 10,
    [key(place(2), CLIENT)]: 12,
    [key(CLIENT, place(1))]: 10, // trajet sortant vers le RDV de 16h de OP-CHARGE
  });

  assert.equal(result.candidates[0].operatorId, "OP-LIBRE");
  assert.ok(result.candidates.every((c) => c.comparable));
  assert.ok(
    result.candidates[0].breakdown.revenueBalance.weighted >
      result.candidates[1].breakdown.revenueBalance.weighted,
  );
});

// ─── 4. Garde-fou anti-détour (§4, §39) ─────────────────────────────────────

test("un CA faible ne fait jamais gagner un opérateur nettement plus loin", async () => {
  const proche = operator({
    id: "OP-PROCHE",
    home: place(1),
    revenueWeekCents: 120_000,
    jobsOnDay: [
      { id: "a", start: at("08:00"), end: at("09:30"), ...place(1), label: "RDV 1" },
      { id: "b", start: at("09:45"), end: at("11:15"), ...place(1), label: "RDV 2" },
      { id: "c", start: at("16:30"), end: at("18:00"), ...place(1), label: "RDV 3" },
    ],
  });
  const loin = operator({ id: "OP-LOIN", home: place(3), revenueWeekCents: 0 });

  const result = await run([proche, loin], {
    [key(place(1), CLIENT)]: 8,
    [key(place(3), CLIENT)]: 38,
    [key(CLIENT, place(1))]: 8,
  });

  const [first] = result.candidates;
  assert.equal(first.operatorId, "OP-PROCHE");

  const far = result.candidates.find((c) => c.operatorId === "OP-LOIN")!;
  assert.equal(far.comparable, false, "OP-LOIN est hors de la cohorte comparable");
  assert.equal(far.breakdown.workload.weighted, 0, "charge neutralisée hors cohorte");
  assert.equal(far.breakdown.revenueBalance.weighted, 0, "CA neutralisé hors cohorte");
  // Le poids retiré est reversé sur la proximité : la somme des poids reste 1.
  const totalWeight = Object.values(far.breakdown).reduce((s, b) => s + b.weight, 0);
  assert.ok(Math.abs(totalWeight - 1) < 1e-9);
});

// ─── 5. La marge de sécurité est réellement configurable (§6) ────────────────

test("la marge de sécurité configurée change l'éligibilité", async () => {
  const op = operator({
    id: "OP-A",
    home: place(1),
    jobsOnDay: [
      { id: "j1", start: at("12:00"), end: at("13:30"), ...place(4), label: "RDV Petit" },
    ],
  });
  const times = { [key(place(4), CLIENT)]: 22 };

  const sansMarge = await run([op], times, { travelSafetyMarginMin: 0 });
  assert.equal(sansMarge.candidates.length, 1, "13h30 + 22 min tient avant 14h00");
  assert.equal(sansMarge.candidates[0].slackBeforeMin, 8);

  const avecMarge = await run([op], times, { travelSafetyMarginMin: 20 });
  assert.equal(avecMarge.candidates.length, 0);
  assert.equal(avecMarge.rejected[0].reason, "INBOUND_TRAVEL");
  assert.match(avecMarge.rejected[0].detail, /manque 12 min/);
});

// ─── 6. Scénario téléphone du §36 ───────────────────────────────────────────

test("§36 — le moteur classe trois candidats avec des scores distincts", async () => {
  const a = operator({
    id: "OP-A",
    home: place(1),
    revenueWeekCents: 30_000,
    jobsOnDay: [{ id: "a1", start: at("09:00"), end: at("10:30"), ...place(1), label: "RDV 1" }],
  });
  const b = operator({
    id: "OP-B",
    home: place(2),
    revenueWeekCents: 60_000,
    jobsOnDay: [
      { id: "b1", start: at("09:00"), end: at("10:30"), ...place(2), label: "RDV 1" },
      { id: "b2", start: at("10:45"), end: at("12:15"), ...place(2), label: "RDV 2" },
    ],
  });
  const c = operator({
    id: "OP-C",
    home: place(3),
    revenueWeekCents: 95_000,
    qualityScore: 70,
    jobsOnDay: [
      { id: "c1", start: at("08:00"), end: at("09:30"), ...place(3), label: "RDV 1" },
      { id: "c2", start: at("09:45"), end: at("11:15"), ...place(3), label: "RDV 2" },
      { id: "c3", start: at("16:15"), end: at("17:45"), ...place(3), label: "RDV 3" },
    ],
  });

  const result = await run([a, b, c], {
    [key(place(1), CLIENT)]: 9,
    [key(place(2), CLIENT)]: 14,
    [key(place(3), CLIENT)]: 18,
    [key(CLIENT, place(3))]: 18,
  });

  assert.equal(result.candidates.length, 3);
  assert.deepEqual(
    result.candidates.map((x) => x.operatorId),
    ["OP-A", "OP-B", "OP-C"],
  );

  const scores = result.candidates.map((x) => x.score);
  assert.ok(scores[0] > scores[1] && scores[1] > scores[2], `scores: ${scores.join(", ")}`);
  assert.ok(scores.every((s) => s >= 0 && s <= 100));

  // Chaque candidat expose de quoi justifier le classement auprès du patron (§4).
  for (const candidate of result.candidates) {
    assert.ok(candidate.originLabel.length > 0);
    assert.equal(typeof candidate.travelMin, "number");
    assert.ok(["LOW", "MEDIUM", "HIGH"].includes(candidate.loadLevel));
  }
});

// ─── Garde-fous complémentaires ─────────────────────────────────────────────

test("un opérateur suspendu ou sans la compétence est éliminé", async () => {
  const suspendu = operator({ id: "OP-SUSP", status: "SUSPENDED", home: place(1) });
  const sansCompetence = operator({ id: "OP-SKILL", serviceIds: ["svc-autre"], home: place(2) });
  const ok = operator({ id: "OP-OK", home: place(3) });

  const result = await run([suspendu, sansCompetence, ok], { [key(place(3), CLIENT)]: 15 });

  assert.equal(result.candidates.length, 1);
  assert.equal(
    result.rejected.find((r) => r.operatorId === "OP-SUSP")?.reason,
    "SUSPENDED",
  );
  assert.equal(
    result.rejected.find((r) => r.operatorId === "OP-SKILL")?.reason,
    "SERVICE_NOT_ALLOWED",
  );
});

test("un créneau à cheval sur la pause déjeuner est refusé", async () => {
  const op = operator({ id: "OP-A", home: place(1) });
  const result = await run([op], { [key(place(1), CLIENT)]: 10 }, {}, { start: at("12:00") });

  assert.equal(result.candidates.length, 0);
  assert.equal(result.rejected[0].reason, "BREAK");
});

test("le moteur n'émet que deux appels cartographiques quel que soit le nombre d'opérateurs", async () => {
  let calls = 0;
  const operators = Array.from({ length: 20 }, (_, i) =>
    operator({
      id: `OP-${i}`,
      home: place(1),
      jobsOnDay: [{ id: `j${i}`, start: at("16:00"), end: at("17:00"), ...place(1), label: "suivant" }],
    }),
  );

  const geo: GeoProvider = {
    name: "counting",
    trafficAware: false,
    async geocode() {
      return null;
    },
    async travelMatrix(origins, destinations) {
      calls += 1;
      return {
        provider: "counting",
        trafficAware: false,
        legs: origins.map(() => destinations.map(() => ({ minutes: 10, km: 5 }))),
      };
    },
  };

  const result = await findBestOperators({
    request: REQUEST,
    operators,
    settings: DEFAULT_ASSIGNMENT_SETTINGS,
    geo,
  });

  assert.equal(calls, 2, "un appel entrant, un appel sortant");
  assert.equal(result.candidates.length, DEFAULT_ASSIGNMENT_SETTINGS.candidatesReturned);
});
