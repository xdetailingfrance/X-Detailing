-- Adresse publique de chaque prestation.
-- On remplit d'abord à partir du code pour ne pas violer la contrainte d'unicité
-- sur les lignes existantes, puis on la pose.
ALTER TABLE "Service" ADD COLUMN "slug" TEXT;

UPDATE "Service" SET "slug" = lower("code") WHERE "slug" IS NULL;

ALTER TABLE "Service" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");
