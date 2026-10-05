import test from "node:test";
import assert from "node:assert/strict";
import { MAX_TRAVEL_KM, TRAVEL_BANDS, travelFeeCents } from "./tarifs";

/**
 * La grille de déplacement décide ce que paie chaque client : une borne mal placée
 * facture une tranche entière de trop, sur chaque réservation, sans que personne ne
 * s'en aperçoive avant la comptabilité.
 */

test("les quatre tranches annoncées sont facturées", () => {
  assert.equal(travelFeeCents(0), 0);
  assert.equal(travelFeeCents(14.9), 0);
  assert.equal(travelFeeCents(20), 1000);
  assert.equal(travelFeeCents(40), 2000);
  assert.equal(travelFeeCents(55), 3000);
});

test("une borne appartient à la tranche qu'elle termine", () => {
  // 15 km exactement reste gratuit : « 0–15 km » inclut 15.
  assert.equal(travelFeeCents(15), 0);
  assert.equal(travelFeeCents(30), 1000);
  assert.equal(travelFeeCents(45), 2000);
  assert.equal(travelFeeCents(60), 3000);
});

test("juste au-dessus d'une borne, la tranche suivante s'applique", () => {
  assert.equal(travelFeeCents(15.1), 1000);
  assert.equal(travelFeeCents(30.1), 2000);
  assert.equal(travelFeeCents(45.1), 3000);
});

test("au-delà de la zone desservie, aucun tarif n'est inventé", () => {
  assert.equal(travelFeeCents(MAX_TRAVEL_KM + 0.1), null);
  assert.equal(travelFeeCents(120), null);
});

test("une distance absurde ne passe pas pour une course gratuite", () => {
  assert.equal(travelFeeCents(-1), null);
  assert.equal(travelFeeCents(Number.NaN), null);
  assert.equal(travelFeeCents(Number.POSITIVE_INFINITY), null);
});

test("les tranches sont ordonnées et sans trou", () => {
  for (let i = 1; i < TRAVEL_BANDS.length; i += 1) {
    assert.ok(
      TRAVEL_BANDS[i].upToKm > TRAVEL_BANDS[i - 1].upToKm,
      "les bornes doivent être croissantes, sinon `find` retient la mauvaise tranche",
    );
    assert.ok(TRAVEL_BANDS[i].priceCents >= TRAVEL_BANDS[i - 1].priceCents);
  }
});
