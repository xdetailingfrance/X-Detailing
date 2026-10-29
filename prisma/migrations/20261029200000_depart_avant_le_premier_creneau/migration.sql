-- Le premier départ proposé aux clients est 8h30, et c'est une heure
-- d'ARRIVÉE chez eux. Un opérateur dont la journée commençait à 8h30 ne
-- pouvait donc jamais honorer ce créneau : depuis Pompignac, le trajet vers
-- Bordeaux le faisait arriver avec une demi-heure de retard, et le moteur
-- d'affectation le refusait — après que le client eut payé son acompte.
--
-- La journée commence désormais au départ du domicile, 45 minutes avant le
-- premier créneau. Les fiches restées sur l'ancien défaut suivent ; celles
-- dont l'horaire a été saisi à la main ne sont pas touchées.
ALTER TABLE "Operateur" ALTER COLUMN "heureDebut" SET DEFAULT '07:45';
UPDATE "Operateur" SET "heureDebut" = '07:45' WHERE "heureDebut" = '08:30';
