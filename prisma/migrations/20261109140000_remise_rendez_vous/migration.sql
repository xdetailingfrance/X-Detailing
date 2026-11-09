-- Remise commerciale sur un rendez-vous, comme il en existait déjà sur les
-- devis. Le pourcentage est ce qui a été négocié et s'affiche ; le montant
-- est ce qui a été déduit, conservé pour que la somme des lignes de la
-- facture retombe exactement sur le total — une reconstitution par division
-- dériverait d'un centime.
ALTER TABLE "RendezVous" ADD COLUMN "remisePourcent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN "remiseMontant" DECIMAL(10,2) NOT NULL DEFAULT 0;
