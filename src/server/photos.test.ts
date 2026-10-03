import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { readExifTakenAt, verifyPhoto } from "./photos";

/**
 * §13 — la vérification qui empêche de ressortir une vieille photo de galerie.
 * Les fichiers de référence sont générés par `scripts/fixtures-photos.ts`.
 */

const FIXTURES = path.join(process.cwd(), "tests", "fixtures", "photos");
const load = (name: string) => readFile(path.join(FIXTURES, name));

test("l'horodatage de prise de vue est lu dans l'EXIF", async () => {
  const taken = readExifTakenAt(await load("avec-exif.jpg"));

  assert.ok(taken, "DateTimeOriginal devrait être trouvé");
  assert.equal(taken.getFullYear(), 2026);
  assert.equal(taken.getMonth() + 1, 9);
  assert.equal(taken.getDate(), 15);
  assert.equal(taken.getHours(), 14);
  assert.equal(taken.getMinutes(), 32);
});

test("une photo sans EXIF ne fait pas planter la lecture", async () => {
  assert.equal(readExifTakenAt(await load("sans-exif.jpg")), null);
});

test("un fichier qui n'est pas un JPEG est rejeté sans exception", async () => {
  assert.equal(readExifTakenAt(await load("pas-jpeg.bin")), null);
});

test("un tampon vide ne fait pas planter la lecture", () => {
  assert.equal(readExifTakenAt(Buffer.alloc(0)), null);
});

// ─── La règle du §13 ─────────────────────────────────────────────────────────

test("une photo prise avant l'arrivée est refusée", async () => {
  const verdict = verifyPhoto({
    buffer: await load("avec-exif.jpg"),
    // La photo date de 14h32 ; l'opérateur est arrivé à 16h00.
    arrivedAt: new Date("2026-09-15T16:00:00"),
    now: new Date("2026-09-15T16:05:00"),
    declaredInApp: true,
  });

  assert.equal(verdict.accepted, false);
  assert.match(verdict.reason ?? "", /avant votre arrivée/);
  assert.ok(verdict.flags.includes("antérieure à l'arrivée"));
});

test("une photo prise après l'arrivée est acceptée", async () => {
  const verdict = verifyPhoto({
    buffer: await load("avec-exif.jpg"),
    arrivedAt: new Date("2026-09-15T14:20:00"),
    now: new Date("2026-09-15T14:35:00"),
    declaredInApp: true,
  });

  assert.equal(verdict.accepted, true);
  assert.deepEqual(verdict.flags, []);
});

test("une horloge d'appareil légèrement en retard reste tolérée", async () => {
  const verdict = verifyPhoto({
    buffer: await load("avec-exif.jpg"),
    // 10 minutes avant l'arrivée : sous la tolérance de 15 minutes.
    arrivedAt: new Date("2026-09-15T14:42:00"),
    now: new Date("2026-09-15T14:45:00"),
    declaredInApp: true,
  });
  assert.equal(verdict.accepted, true);
});

test("l'absence d'EXIF est signalée mais n'interdit pas la photo", async () => {
  const verdict = verifyPhoto({
    buffer: await load("sans-exif.jpg"),
    arrivedAt: new Date("2026-09-15T14:00:00"),
    now: new Date("2026-09-15T14:30:00"),
    declaredInApp: true,
  });

  assert.equal(verdict.accepted, true);
  assert.ok(verdict.flags.includes("aucun horodatage EXIF"));
});

test("un import déclaré depuis la galerie est tracé", async () => {
  const verdict = verifyPhoto({
    buffer: await load("sans-exif.jpg"),
    arrivedAt: new Date("2026-09-15T14:00:00"),
    now: new Date("2026-09-15T14:30:00"),
    declaredInApp: false,
  });

  assert.ok(verdict.flags.includes("import depuis la galerie déclaré"));
});
