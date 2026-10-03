-- Jeton de suivi public : ajouté en nullable, rempli, puis rendu obligatoire, afin de
-- ne pas casser sur les rendez-vous déjà en base.
ALTER TABLE "Appointment" ADD COLUMN "publicToken" TEXT;

UPDATE "Appointment" SET "publicToken" = gen_random_uuid()::text WHERE "publicToken" IS NULL;

ALTER TABLE "Appointment" ALTER COLUMN "publicToken" SET NOT NULL;

CREATE UNIQUE INDEX "Appointment_publicToken_key" ON "Appointment"("publicToken");
