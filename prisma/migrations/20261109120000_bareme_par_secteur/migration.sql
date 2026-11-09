-- Barème de déplacement propre à chaque secteur. Les distances se comptent
-- depuis le centre du secteur, pas depuis Pompignac : un client toulousain
-- se voyait sinon facturer deux cents kilomètres, ou refusé comme hors zone.
--
-- Les secteurs existants restent sans barème : ils retombent sur celui par
-- défaut, qui est l'actuel.
ALTER TABLE "Secteur" ADD COLUMN "tranches" JSONB;
