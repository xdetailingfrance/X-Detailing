import test from "node:test";
import assert from "node:assert/strict";

import { assess } from "./weather";
import type { HourlyWeather } from "@/lib/providers/weather";

/** §9 — les conditions qui rendent un lavage extérieur impossible, et celles qui non. */

const hour = (over: Partial<HourlyWeather> = {}): HourlyWeather => ({
  at: new Date("2026-09-15T10:00:00"),
  precipitationMm: 0,
  temperatureC: 18,
  windKph: 10,
  conditionCode: "0",
  ...over,
});

test("des conditions clémentes laissent passer la prestation", () => {
  const result = assess([hour(), hour()], true);
  assert.equal(result?.verdict, "OK");
  assert.equal(result?.reason, null);
});

test("une pluie soutenue rend un lavage extérieur impossible", () => {
  const result = assess([hour(), hour({ precipitationMm: 3.2 })], true);
  assert.equal(result?.verdict, "INCOMPATIBLE");
  assert.match(result?.reason ?? "", /pluie/);
});

test("le gel rend un lavage extérieur impossible", () => {
  const result = assess([hour({ temperatureC: -2 })], true);
  assert.equal(result?.verdict, "INCOMPATIBLE");
  assert.match(result?.reason ?? "", /gel/);
});

test("des averses légères passent en risque, pas en impossibilité", () => {
  const result = assess([hour({ precipitationMm: 0.8 })], true);
  assert.equal(result?.verdict, "RISK");
});

test("le pire moment de la fenêtre l'emporte", () => {
  // Une averse en milieu de prestation gâche tout le lavage, même si le reste est sec.
  const result = assess([hour(), hour({ precipitationMm: 5 }), hour()], true);
  assert.equal(result?.verdict, "INCOMPATIBLE");
  assert.equal(result?.precipitationMm, 5);
});

test("un lavage intérieur n'est pas empêché par la pluie", () => {
  const result = assess([hour({ precipitationMm: 3.2 })], false);
  assert.equal(result?.verdict, "OK");
});

test("un lavage intérieur signale tout de même une pluie très forte", () => {
  const result = assess([hour({ precipitationMm: 6 })], false);
  assert.equal(result?.verdict, "RISK");
});

test("le vent fort est un risque, pas un empêchement", () => {
  const result = assess([hour({ windKph: 60 })], true);
  assert.equal(result?.verdict, "RISK");
  assert.match(result?.reason ?? "", /vent/);
});

test("sans prévision, aucun jugement n'est rendu", () => {
  assert.equal(assess([], true), null);
});
