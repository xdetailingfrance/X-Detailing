import test from "node:test";
import assert from "node:assert/strict";

import { giniCoefficient } from "./statistics";

/**
 * §5 — « historiser les affectations afin d'analyser si la répartition du CA est
 * équilibrée ». Le chiffre doit vouloir dire quelque chose avant d'être affiché.
 */

test("une répartition parfaitement égale donne zéro", () => {
  assert.equal(giniCoefficient([1000, 1000, 1000, 1000]), 0);
});

test("tout le CA sur un seul opérateur tend vers un", () => {
  const gini = giniCoefficient([0, 0, 0, 4000]);
  assert.ok(gini !== null && gini > 0.7, `attendu > 0.7, obtenu ${gini}`);
});

test("un déséquilibre modéré se situe entre les deux", () => {
  const gini = giniCoefficient([800, 1000, 1200, 1400]);
  assert.ok(gini !== null && gini > 0 && gini < 0.3, `attendu entre 0 et 0.3, obtenu ${gini}`);
});

test("l'indice est sans unité : il ne dépend pas du volume", () => {
  // Même forme de répartition, dix fois le chiffre d'affaires.
  assert.equal(giniCoefficient([100, 200, 300]), giniCoefficient([1000, 2000, 3000]));
});

test("un réseau sans activité est considéré comme équilibré", () => {
  assert.equal(giniCoefficient([0, 0, 0]), 0);
});

test("un seul opérateur ne permet aucune comparaison", () => {
  assert.equal(giniCoefficient([5000]), null);
  assert.equal(giniCoefficient([]), null);
});

test("l'ordre des opérateurs n'a aucune influence", () => {
  assert.equal(giniCoefficient([300, 100, 200]), giniCoefficient([100, 200, 300]));
});
