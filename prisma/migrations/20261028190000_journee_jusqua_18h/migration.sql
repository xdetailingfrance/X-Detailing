-- Une prestation intérieur + extérieur dure 3 h : au départ de 15h elle finit
-- à 18h. Une journée qui s'arrête à 17h30 ferme donc ce dernier créneau.
-- On repousse la fin de journée des opérateurs restés sur l'ancien défaut ;
-- ceux dont l'horaire a été saisi à la main ne sont pas touchés.
ALTER TABLE "Operateur" ALTER COLUMN "heureFin" SET DEFAULT '18:00';
UPDATE "Operateur" SET "heureFin" = '18:00' WHERE "heureFin" = '17:30';
