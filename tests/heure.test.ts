// Heure de Paris indépendante du fuseau du serveur (lancé en TZ=UTC).
import { test } from "node:test";
import assert from "node:assert/strict";
import { dateParis, debutSemaineParis, decalerJour, formatParis, heureParis, jourParis, jourSemaineParis, lireDateSaisie } from "@/lib/heure";

test("08:30 à Paris en hiver = 07:30 UTC, en été = 06:30 UTC", () => {
  assert.equal(dateParis("2026-01-15", "08:30").toISOString(), "2026-01-15T07:30:00.000Z");
  assert.equal(dateParis("2026-07-15", "08:30").toISOString(), "2026-07-15T06:30:00.000Z");
});

test("changements d'heure (29 mars et 25 octobre 2026)", () => {
  assert.equal(dateParis("2026-03-29", "12:00").toISOString(), "2026-03-29T10:00:00.000Z");
  assert.equal(dateParis("2026-10-25", "12:00").toISOString(), "2026-10-25T11:00:00.000Z");
  assert.equal(dateParis("2026-10-25").toISOString(), "2026-10-24T22:00:00.000Z");
});

test("jour, heure et jour de la semaine à Paris", () => {
  const instant = new Date("2026-10-31T23:30:00.000Z"); // dimanche 1er novembre 00:30 à Paris
  assert.equal(jourParis(instant), "2026-11-01");
  assert.equal(heureParis(instant), "00:30");
  assert.equal(jourSemaineParis(instant), 0);
  assert.equal(decalerJour("2026-12-31", 1), "2027-01-01");
  assert.equal(jourParis(debutSemaineParis(instant)), "2026-10-26");
});

test("affichage et saisie de formulaire en heure de Paris", () => {
  assert.equal(formatParis(dateParis("2026-10-26", "15:00"), { hour: "2-digit", minute: "2-digit" }), "15:00");
  assert.equal(lireDateSaisie("2026-10-26T08:30").toISOString(), "2026-10-26T07:30:00.000Z");
  assert.equal(lireDateSaisie("2026-10-26T08:30:00.000Z").toISOString(), "2026-10-26T08:30:00.000Z");
});

