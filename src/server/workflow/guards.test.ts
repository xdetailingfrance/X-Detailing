import test from "node:test";
import assert from "node:assert/strict";

import { checkTransition } from "./guards";
import { REQUIRED_SLOTS, type Transition, type WorkflowSnapshot } from "./types";
import type { AppointmentStatus, PhotoPhase } from "@/generated/prisma/enums";

/**
 * Le §12 énonce six interdits. Chacun a son test : c'est une exigence de conformité,
 * pas d'ergonomie, et une régression ici ne se verrait pas à l'écran.
 */

const OPERATOR = "op-1";
const NOW = new Date("2026-06-15T12:00:00Z");

const photos = (phase: PhotoPhase, count = REQUIRED_SLOTS.length) =>
  REQUIRED_SLOTS.slice(0, count).map((slot) => ({ phase, slot }));

function snapshot(over: Partial<WorkflowSnapshot> = {}): WorkflowSnapshot {
  return {
    id: "rdv-1",
    reference: "XD-2606-0001",
    status: "CONFIRMED",
    operatorId: OPERATOR,
    scheduledStart: new Date("2026-06-15T13:00:00Z"),
    totalCents: 8500,
    arrivedAt: null,
    startedAt: null,
    photos: [],
    payments: [],
    hasSignature: true,
    pendingAdjustment: false,
    ...over,
  };
}

const run = (transition: Transition, over: Partial<WorkflowSnapshot> = {}, now = NOW) =>
  checkTransition(transition, snapshot(over), { operatorId: OPERATOR, now });

// ─── La chaîne complète, dans l'ordre ────────────────────────────────────────

test("le parcours nominal enchaîne les sept états du §12", () => {
  const steps: Array<[Transition, Partial<WorkflowSnapshot>, AppointmentStatus]> = [
    ["START_TRIP", { status: "CONFIRMED" }, "EN_ROUTE"],
    ["ARRIVE", { status: "EN_ROUTE" }, "ARRIVED"],
    [
      "VALIDATE_PHOTOS_BEFORE",
      { status: "ARRIVED", arrivedAt: NOW, photos: photos("BEFORE") },
      "PHOTOS_BEFORE",
    ],
    ["START_SERVICE", { status: "PHOTOS_BEFORE" }, "IN_PROGRESS"],
    [
      "VALIDATE_PHOTOS_AFTER",
      {
        status: "IN_PROGRESS",
        startedAt: NOW,
        photos: [...photos("BEFORE"), ...photos("AFTER")],
      },
      "PHOTOS_AFTER",
    ],
    ["OPEN_PAYMENT", { status: "PHOTOS_AFTER" }, "PAYMENT"],
    [
      "COMPLETE",
      {
        status: "PAYMENT",
        payments: [{ status: "PAID", amountCents: 8500, receivedCents: 8500, discrepancyCents: 0 }],
      },
      "COMPLETED",
    ],
  ];

  for (const [transition, state, expected] of steps) {
    const result = run(transition, state);
    assert.ok(result.ok, `${transition} devrait passer, refusé : ${!result.ok && result.message}`);
    assert.equal(result.nextStatus, expected);
  }
});

// ─── « Pas d'arrivée validée = pas de photos avant » ─────────────────────────

test("sans arrivée validée, les photos avant ne peuvent pas être validées", () => {
  const result = run("VALIDATE_PHOTOS_BEFORE", {
    status: "EN_ROUTE",
    photos: photos("BEFORE"),
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "WRONG_STATE");
});

// ─── « Pas de photos avant validées = pas de démarrage » ─────────────────────

test("sans les quatre photos avant, la prestation ne démarre pas", () => {
  const result = run("VALIDATE_PHOTOS_BEFORE", {
    status: "ARRIVED",
    arrivedAt: NOW,
    photos: photos("BEFORE", 2),
  });

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "PHOTOS_MISSING");
  // Le message nomme ce qui manque : l'opérateur doit savoir quoi photographier.
  assert.match(!result.ok ? result.message : "", /arrière/);
  assert.match(!result.ok ? result.message : "", /intérieur/);
});

test("depuis ARRIVED, démarrer la prestation est refusé", () => {
  const result = run("START_SERVICE", { status: "ARRIVED", arrivedAt: NOW });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "WRONG_STATE");
});

// ─── « Pas de prestation démarrée = pas de photos après » ────────────────────

test("les photos après sont refusées tant que la prestation n'est pas démarrée", () => {
  const result = run("VALIDATE_PHOTOS_AFTER", {
    status: "PHOTOS_BEFORE",
    photos: [...photos("BEFORE"), ...photos("AFTER")],
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "WRONG_STATE");
});

// ─── « Pas de photos après validées = pas d'encaissement » ───────────────────

test("l'encaissement est refusé tant que les photos après ne sont pas validées", () => {
  const result = run("OPEN_PAYMENT", { status: "IN_PROGRESS", startedAt: NOW });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "WRONG_STATE");
});

test("les photos avant ne comptent pas comme photos après", () => {
  const result = run("VALIDATE_PHOTOS_AFTER", {
    status: "IN_PROGRESS",
    startedAt: NOW,
    photos: photos("BEFORE"),
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "PHOTOS_MISSING");
});

// ─── « Pas de paiement validé = pas de terminaison » ─────────────────────────

test("une prestation non entièrement encaissée ne peut pas être terminée", () => {
  const result = run("COMPLETE", {
    status: "PAYMENT",
    payments: [{ status: "PAID", amountCents: 2550, receivedCents: 2550, discrepancyCents: 0 }],
  });

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "PAYMENT_INCOMPLETE");
  assert.match(!result.ok ? result.message : "", /59\.50 €|59,50 €/);
});

test("un paiement en attente ne compte pas comme encaissé", () => {
  const result = run("COMPLETE", {
    status: "PAYMENT",
    payments: [{ status: "PENDING", amountCents: 8500, receivedCents: null, discrepancyCents: 0 }],
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "PAYMENT_INCOMPLETE");
});

// ─── §16 — l'écart de caisse bloque la clôture ───────────────────────────────

test("un écart de caisse bloque la clôture même si le total est atteint", () => {
  const result = run("COMPLETE", {
    status: "PAYMENT",
    payments: [
      { status: "PAID", amountCents: 8500, receivedCents: 8000, discrepancyCents: -500 },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "CASH_MISMATCH");
  assert.match(!result.ok ? result.message : "", /central/);
});

// ─── Périmètre de l'opérateur (§31) ──────────────────────────────────────────

test("un opérateur ne peut pas agir sur le rendez-vous d'un autre", () => {
  const result = checkTransition("ARRIVE", snapshot({ status: "EN_ROUTE" }), {
    operatorId: "op-2",
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "NOT_ASSIGNED");
});

test("le back-office n'est pas soumis à la règle d'appartenance", () => {
  const result = checkTransition("CANCEL", snapshot({ status: "CONFIRMED" }), {
    operatorId: null,
    now: NOW,
  });
  assert.ok(result.ok);
});

// ─── Garde-fous de bon sens ──────────────────────────────────────────────────

test("le trajet ne peut pas démarrer des heures à l'avance", () => {
  const veille = new Date("2026-06-14T13:00:00Z");
  const result = run("START_TRIP", { status: "CONFIRMED" }, veille);
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "TOO_EARLY");
});

test("une prestation démarrée ne peut plus être annulée", () => {
  const result = run("CANCEL", { status: "IN_PROGRESS", startedAt: NOW });
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.message : "", /démarrée/);
});

test("on ne peut pas sauter directement de l'arrivée à la clôture", () => {
  const result = run("COMPLETE", { status: "ARRIVED", arrivedAt: NOW });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "WRONG_STATE");
});

// ─── §31 §32 — l'accord du client conditionne le démarrage ───────────────────

test("sans signature du client, la prestation ne démarre pas", () => {
  const result = run("START_SERVICE", { status: "PHOTOS_BEFORE", hasSignature: false });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "SIGNATURE_MISSING");
});

test("un changement de catégorie non accepté bloque le démarrage", () => {
  const result = run("START_SERVICE", {
    status: "PHOTOS_BEFORE",
    hasSignature: true,
    pendingAdjustment: true,
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "ADJUSTMENT_PENDING");
  assert.match(!result.ok ? result.message : "", /nouveau tarif/);
});

test("le tarif accepté et la signature obtenue, la prestation démarre", () => {
  const result = run("START_SERVICE", {
    status: "PHOTOS_BEFORE",
    hasSignature: true,
    pendingAdjustment: false,
  });
  assert.ok(result.ok);
  assert.equal(result.nextStatus, "IN_PROGRESS");
});

// ─── §36 — l'impayé n'est déclarable qu'avec la preuve ───────────────────────

test("un impayé se déclare quand la preuve est complète", () => {
  const result = run("MARK_UNPAID", {
    status: "PAYMENT",
    hasSignature: true,
    photos: [...photos("BEFORE"), ...photos("AFTER")],
  });
  assert.ok(result.ok);
  assert.equal(result.nextStatus, "UNPAID");
});

test("sans signature, l'impayé n'est pas déclarable", () => {
  const result = run("MARK_UNPAID", {
    status: "PAYMENT",
    hasSignature: false,
    photos: [...photos("BEFORE"), ...photos("AFTER")],
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "PROOF_MISSING");
  assert.match(!result.ok ? result.message : "", /signature/);
});

test("sans photos après, l'impayé n'est pas déclarable", () => {
  const result = run("MARK_UNPAID", {
    status: "PAYMENT",
    hasSignature: true,
    photos: photos("BEFORE"),
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "PROOF_MISSING");
  assert.match(!result.ok ? result.message : "", /photo/);
});

test("un impayé ne se déclare pas avant l'encaissement", () => {
  const result = run("MARK_UNPAID", { status: "IN_PROGRESS", startedAt: NOW });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "WRONG_STATE");
});
