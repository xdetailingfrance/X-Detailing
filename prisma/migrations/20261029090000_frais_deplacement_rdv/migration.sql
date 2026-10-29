-- Le supplément de route entre dans le prix des réservations en ligne. Il est
-- conservé à part du total pour que la facture puisse en faire une ligne, et
-- la distance est figée : le barème peut changer, pas un prix déjà accepté.
ALTER TABLE "RendezVous" ADD COLUMN "fraisDeplacement" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "distanceKm" DOUBLE PRECISION;
