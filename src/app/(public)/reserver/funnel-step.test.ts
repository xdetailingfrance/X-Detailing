import test from "node:test";
import assert from "node:assert/strict";
import { initialStep, STEP_ADDRESS, STEP_SERVICE, STEP_VEHICLE } from "./funnel-step";

test("sans rien, on commence par le véhicule", () => {
  assert.equal(initialStep(null), STEP_VEHICLE);
  assert.equal(initialStep(undefined), STEP_VEHICLE);
  assert.equal(initialStep({}), STEP_VEHICLE);
});

test("une prestation seule ne fait pas sauter le véhicule", () => {
  // Le cas qui cassait la réservation : les cartes de pack transmettent la
  // prestation sans la catégorie, le tunnel ouvrait à l'adresse, et le serveur
  // refusait tout à la fin avec « Invalid option ».
  assert.equal(initialStep({ serviceId: "svc_1" }), STEP_VEHICLE);
  assert.equal(initialStep({ serviceId: "svc_1", vehicleClass: null }), STEP_VEHICLE);
});

test("un véhicule seul amène à la prestation", () => {
  assert.equal(initialStep({ vehicleClass: "SUV" }), STEP_SERVICE);
});

test("les deux réponses amènent à l'adresse", () => {
  assert.equal(initialStep({ vehicleClass: "SUV", serviceId: "svc_1" }), STEP_ADDRESS);
});
