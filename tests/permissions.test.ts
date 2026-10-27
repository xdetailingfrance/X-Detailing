import { test } from "node:test";
import assert from "node:assert/strict";
import { aLaPermission, accueilDuRole, permissionRequise } from "@/lib/permissions";

test("chaque chemin sensible exige sa permission", () => {
  assert.equal(permissionRequise("/back-office/finances"), "finances");
  assert.equal(permissionRequise("/api/packs/pack-concession/tarifs"), "tarifs");
  assert.equal(permissionRequise("/api/rendez-vous/abc/affectation"), "planning");
  assert.equal(permissionRequise("/back-office/journal"), "audit");
  assert.equal(permissionRequise("/back-office/finances-bis"), null);
});

test("périmètres des rôles", () => {
  assert.ok(aLaPermission("OWNER", "audit"));
  assert.ok(!aLaPermission("COMMERCIAL", "finances"));
  assert.ok(!aLaPermission("COMMERCIAL", "tarifs"));
  assert.ok(aLaPermission("RESPONSABLE", "operateurs"));
  assert.ok(!aLaPermission("RESPONSABLE", "finances"));
  assert.ok(aLaPermission("COMPTABLE", "finances"));
  assert.ok(!aLaPermission("COMPTABLE", "clients"));
  assert.ok(!aLaPermission("COMPTABLE", "planning"));
  assert.ok(!aLaPermission("OPERATEUR", "clients"));
  assert.equal(accueilDuRole("COMPTABLE"), "/back-office/finances");
  assert.equal(accueilDuRole("OPERATEUR"), "/operateur");
});

