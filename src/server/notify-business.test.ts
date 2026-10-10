import test from "node:test";
import assert from "node:assert/strict";
import { notifyBusiness } from "./notify-business";

/**
 * Le seul comportement testable sans réseau est aussi le plus important : sans clé,
 * rien ne part. Un poste de développement, une préproduction ou un test qui écrirait
 * à l'entreprise à chaque exécution rendrait la boîte inutilisable, et on finirait
 * par ignorer les vraies candidatures.
 */

test("sans clé, aucun envoi et la raison est explicite", async () => {
  const saved = process.env.WEB3FORMS_ACCESS_KEY;
  delete process.env.WEB3FORMS_ACCESS_KEY;

  const result = await notifyBusiness({
    subject: "Essai",
    lines: [["Nom", "Dupont"]],
  });

  assert.equal(result.sent, false);
  assert.match(result.reason ?? "", /WEB3FORMS_ACCESS_KEY/);

  if (saved !== undefined) process.env.WEB3FORMS_ACCESS_KEY = saved;
});

test("l'absence de clé ne lève pas : la candidature reste enregistrée", async () => {
  const saved = process.env.WEB3FORMS_ACCESS_KEY;
  delete process.env.WEB3FORMS_ACCESS_KEY;

  // L'appelant enregistre en base d'abord et notifie ensuite ; une exception ici
  // afficherait au candidat un échec alors que sa candidature est bien reçue.
  await assert.doesNotReject(() => notifyBusiness({ subject: "Essai", lines: [] }));

  if (saved !== undefined) process.env.WEB3FORMS_ACCESS_KEY = saved;
});
