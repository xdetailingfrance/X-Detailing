import test from "node:test";
import assert from "node:assert/strict";

import { computeQualityScore, NEUTRAL_SCORE, type QualityInput } from "./score";

/** §25 — le score alimente le moteur d'affectation : il doit être explicable. */

const base: QualityInput = {
  averageRating: 4.5,
  reviewCount: 10,
  punctuality: 0.9,
  completedWithFullPhotos: 20,
  completedCount: 20,
  complaints: 0,
  noShows: 0,
};

test("un opérateur irréprochable approche de 100", () => {
  const { score } = computeQualityScore({
    ...base,
    averageRating: 5,
    punctuality: 1,
  });
  assert.ok(score >= 95, `attendu ≥ 95, obtenu ${score}`);
});

test("un opérateur sans historique reste neutre", () => {
  const { score } = computeQualityScore({
    averageRating: null, reviewCount: 0, punctuality: null,
    completedWithFullPhotos: 0, completedCount: 0, complaints: 0, noShows: 0,
  });
  assert.equal(score, NEUTRAL_SCORE);
});

test("des retards répétés font baisser le score", () => {
  const ponctuel = computeQualityScore(base).score;
  const retardataire = computeQualityScore({ ...base, punctuality: 0.4 }).score;
  assert.ok(retardataire < ponctuel - 10, `${retardataire} devrait être bien sous ${ponctuel}`);
});

test("des photos manquantes pèsent sur la conformité", () => {
  const conforme = computeQualityScore(base).score;
  const partiel = computeQualityScore({ ...base, completedWithFullPhotos: 8 }).score;
  assert.ok(partiel < conforme, `${partiel} devrait être sous ${conforme}`);
});

test("les incidents pèsent sur le score", () => {
  const sansIncident = computeQualityScore(base).score;
  const avecIncidents = computeQualityScore({ ...base, complaints: 3, noShows: 2 }).score;
  assert.ok(avecIncidents < sansIncident);
});

test("un axe sans donnée ne pénalise pas : son poids est redistribué", () => {
  // Aucun avis, mais tout le reste parfait : le score doit rester élevé.
  const { score, axes } = computeQualityScore({
    ...base,
    averageRating: null,
    reviewCount: 0,
    punctuality: 1,
  });

  assert.ok(score >= 95, `attendu ≥ 95 malgré l'absence d'avis, obtenu ${score}`);
  assert.equal(axes.find((a) => a.key === "reviews")?.value, null);
  assert.equal(axes.find((a) => a.key === "reviews")?.note, "aucun avis");
});

test("chaque axe porte de quoi être expliqué à l'opérateur", () => {
  const { axes } = computeQualityScore(base);
  assert.equal(axes.length, 4);
  for (const axis of axes) {
    assert.ok(axis.label.length > 0);
    assert.ok(axis.note.length > 0, `l'axe ${axis.key} doit porter une explication`);
    assert.ok(axis.weight > 0);
  }
  assert.equal(
    Math.round(axes.reduce((sum, a) => sum + a.weight, 0) * 100) / 100,
    1,
    "les poids doivent sommer à 1",
  );
});

test("une note de 1/5 effondre l'axe avis", () => {
  const { axes } = computeQualityScore({ ...base, averageRating: 1 });
  assert.equal(axes.find((a) => a.key === "reviews")?.value, 0);
});
