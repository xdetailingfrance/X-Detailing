-- Périmètre d'intervention d'un secteur : un centre et un rayon. C'est ce
-- qui permet d'attribuer un rendez-vous à l'opérateur qui couvre la zone,
-- sans passer par une validation manuelle.
--
-- Les secteurs existants restent sans périmètre : tant qu'aucun n'en a,
-- l'attribution retombe sur l'unique opérateur actif, ce qui est le
-- fonctionnement voulu aujourd'hui.
ALTER TABLE "Secteur" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "rayonKm" DOUBLE PRECISION;
