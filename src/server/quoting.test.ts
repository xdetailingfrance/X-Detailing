import test from "node:test";
import assert from "node:assert/strict";

import { depositFor, DEFAULT_QUOTING } from "./quoting";

/** §21 — « 159 € · Acompte aujourd'hui : 15,90 € · Solde après prestation : 143,10 € ». */

test("l'exemple du cahier des charges tombe juste", () => {
  const deposit = depositFor(15_900, DEFAULT_QUOTING);
  assert.equal(deposit, 1590, "159 € → 15,90 € d'acompte");
  assert.equal(15_900 - deposit, 14_310, "solde de 143,10 €");
});

test("le plancher protège les petites prestations", () => {
  // 10 % de 29 € font 2,90 € : les frais de transaction mangeraient l'acompte.
  assert.equal(depositFor(2_900, DEFAULT_QUOTING), DEFAULT_QUOTING.minimumDepositCents);
});

test("le plafond évite de bloquer une grosse somme", () => {
  assert.equal(depositFor(90_000, DEFAULT_QUOTING), DEFAULT_QUOTING.maximumDepositCents);
});

test("l'acompte ne dépasse jamais le total", () => {
  // Prestation sous le plancher : on ne demande pas plus que le prix.
  assert.equal(depositFor(500, DEFAULT_QUOTING), 500);
});

test("un total nul ne demande aucun acompte", () => {
  assert.equal(depositFor(0, DEFAULT_QUOTING), 0);
  assert.equal(depositFor(-100, DEFAULT_QUOTING), 0);
});

test("le taux est réellement configurable", () => {
  const trente = { ...DEFAULT_QUOTING, depositRate: 0.3, maximumDepositCents: 100_000 };
  assert.equal(depositFor(15_900, trente), 4770);
});

test("un acompte à zéro reste possible", () => {
  const aucun = { depositRate: 0, minimumDepositCents: 0, maximumDepositCents: 0 };
  assert.equal(depositFor(15_900, aucun), 0);
});
