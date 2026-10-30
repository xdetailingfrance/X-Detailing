-- Le code postal était saisi au devis, envoyé par le formulaire, puis jeté
-- par l'API. À la conversion en rendez-vous, l'adresse était donc géocodée
-- sans lui : « Carignan » a résolu vers la commune des Ardennes, à 700 km,
-- et le moteur d'affectation a refusé le dossier en annonçant 1025 minutes
-- de retard. On le conserve.
ALTER TABLE "Devis" ADD COLUMN "codePostal" TEXT;
