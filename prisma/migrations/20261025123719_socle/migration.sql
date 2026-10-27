-- CreateEnum
CREATE TYPE "CategorieVehicule" AS ENUM ('CITADINE', 'BERLINE', 'SUV', 'MONOSPACE', 'UTILITAIRE');

-- CreateEnum
CREATE TYPE "StatutOperateur" AS ENUM ('ACTIF', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "StatutRendezVous" AS ENUM ('EN_ATTENTE', 'CONFIRME', 'EN_ROUTE', 'ARRIVE', 'CONTROLE', 'PHOTOS_AVANT', 'LAVAGE', 'PHOTOS_APRES', 'PAIEMENT', 'EN_COURS', 'TERMINE', 'ANNULE');

-- CreateEnum
CREATE TYPE "SourceRendezVous" AS ENUM ('SITE_CLIENT', 'TELEPHONE', 'LEAD_META', 'LAVER_MAINTENANT', 'DEVIS');

-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('OWNER', 'RESPONSABLE', 'COMMERCIAL', 'OPERATEUR', 'COMPTABLE');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('CARTE', 'ESPECES');

-- CreateEnum
CREATE TYPE "StatutAcompte" AS ENUM ('EN_ATTENTE_PAIEMENT', 'PAYE');

-- CreateEnum
CREATE TYPE "StatutDevis" AS ENUM ('BROUILLON', 'ENVOYE', 'CONSULTE', 'ACCEPTE', 'ACOMPTE_PAYE', 'RDV_CREE', 'REFUSE');

-- CreateEnum
CREATE TYPE "TypeClientDevis" AS ENUM ('PARTICULIER', 'PRO');

-- CreateEnum
CREATE TYPE "MotifSms" AS ENUM ('CONFIRMATION_RDV', 'AFFECTATION_OPERATEUR', 'MODIFICATION_RDV', 'ANNULATION_RDV', 'RAPPEL_VEILLE', 'MANUEL');

-- CreateEnum
CREATE TYPE "StatutSms" AS ENUM ('ENVOYE', 'SIMULE', 'ECHEC');

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "RoleUtilisateur" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "operateurId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Secteur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ville" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "Secteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

      CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adresse" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "libelle" TEXT,
    "adresse" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "codePostal" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "Adresse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicule" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "categorie" "CategorieVehicule" NOT NULL,
    "marque" TEXT,
    "modele" TEXT,
    "immatriculation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "Vehicule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operateur" (
    "id" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "statut" "StatutOperateur" NOT NULL DEFAULT 'ACTIF',
    "secteurId" TEXT,
    "adresseDomicile" TEXT,
    "latitudeDomicile" DOUBLE PRECISION,
    "longitudeDomicile" DOUBLE PRECISION,
    "heureDebut" TEXT NOT NULL DEFAULT '08:30',
    "heureFin" TEXT NOT NULL DEFAULT '17:30',
    "kangooImmatriculation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

      CONSTRAINT "Operateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pack" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "dureeMinMinutes" INTEGER NOT NULL,
    "dureeMaxMinutes" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackTarif" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "categorie" "CategorieVehicule" NOT NULL,
    "prix" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

      CONSTRAINT "PackTarif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prix" DECIMAL(10,2) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
      "groupe" TEXT,
      "unite" TEXT,
      "quantiteMax" INTEGER,
      "ordre" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RendezVous" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vehiculeId" TEXT NOT NULL,
    "adresseId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "categorieVehicule" "CategorieVehicule" NOT NULL,
    "secteurId" TEXT,
    "operateurId" TEXT,
    "dateHeure" TIMESTAMP(3) NOT NULL,
    "dureeMinutes" INTEGER NOT NULL,
    "prixTotal" DECIMAL(10,2) NOT NULL,
    "acompte" DECIMAL(10,2) NOT NULL,
    "statut" "StatutRendezVous" NOT NULL DEFAULT 'EN_ATTENTE',
    "source" "SourceRendezVous" NOT NULL DEFAULT 'TELEPHONE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "suiviToken" TEXT NOT NULL,
    "routeDemarreeAt" TIMESTAMP(3),
    "signatureControleDataUrl" TEXT,
    "signatureControleAt" TIMESTAMP(3),
    "photosAvant" JSONB NOT NULL,
    "lavageDemarreAt" TIMESTAMP(3),
    "photosApres" JSONB NOT NULL,
    "signatureFinDataUrl" TEXT,
    "signatureFinAt" TIMESTAMP(3),
    "modePaiement" "ModePaiement",
    "lienPaiementEnvoyeAt" TIMESTAMP(3),
    "paiementConfirmeAt" TIMESTAMP(3),
    "numeroFacture" TEXT,
    "historique" JSONB NOT NULL,
    "noteClient" INTEGER,
    "noteClientAt" TIMESTAMP(3),
    "acompteStatut" "StatutAcompte",
    "stripeSessionId" TEXT,

      CONSTRAINT "RendezVous_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RendezVousOption" (
    "id" TEXT NOT NULL,
    "rendezVousId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "prixUnitaire" DECIMAL(10,2) NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,

      CONSTRAINT "RendezVousOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffectationCandidat" (
    "id" TEXT NOT NULL,
    "rendezVousId" TEXT NOT NULL,
    "operateurId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "etaMinutes" INTEGER NOT NULL,
    "rang" INTEGER NOT NULL,
    "retenu" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "AffectationCandidat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devis" (
      "id" TEXT NOT NULL,
      "token" TEXT NOT NULL,
      "typeClient" "TypeClientDevis" NOT NULL,
      "nomClient" TEXT NOT NULL,
      "telephoneClient" TEXT NOT NULL,
      "emailClient" TEXT,
      "raisonSociale" TEXT,
      "adresse" TEXT NOT NULL,
      "ville" TEXT NOT NULL,
      "vehiculeDescription" TEXT NOT NULL,
      "categorieVehicule" "CategorieVehicule" NOT NULL,
      "packId" TEXT NOT NULL,
      "optionIds" TEXT[],
      "prixTotal" DECIMAL(10,2) NOT NULL,
      "acompte" DECIMAL(10,2) NOT NULL,
      "statut" "StatutDevis" NOT NULL DEFAULT 'BROUILLON',
      "creeParUtilisateurId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      "envoyeAt" TIMESTAMP(3),
      "consulteAt" TIMESTAMP(3),
      "accepteAt" TIMESTAMP(3),
      "acomptePayeAt" TIMESTAMP(3),
      "rendezVousId" TEXT,
      "historique" JSONB NOT NULL,

      CONSTRAINT "Devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepensesMensuelles" (
    "id" TEXT NOT NULL,
    "mois" TEXT NOT NULL,
    "depenses" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "publicite" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

      CONSTRAINT "DepensesMensuelles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sms" (
    "id" TEXT NOT NULL,
    "destinataire" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "motif" "MotifSms" NOT NULL,
    "statut" "StatutSms" NOT NULL,
    "erreur" TEXT,
    "rendezVousId" TEXT,
    "envoyePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "Sms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalAudit" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acteurId" TEXT,
    "acteur" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT,
    "details" JSONB,

      CONSTRAINT "JournalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_operateurId_key" ON "Utilisateur"("operateurId");

-- CreateIndex
CREATE INDEX "Client_telephone_idx" ON "Client"("telephone");

-- CreateIndex
CREATE INDEX "Adresse_clientId_idx" ON "Adresse"("clientId");

-- CreateIndex
CREATE INDEX "Vehicule_clientId_idx" ON "Vehicule"("clientId");

-- CreateIndex
CREATE INDEX "Operateur_secteurId_idx" ON "Operateur"("secteurId");

-- CreateIndex
CREATE UNIQUE INDEX "PackTarif_packId_categorie_key" ON "PackTarif"("packId", "categorie");

-- CreateIndex
CREATE UNIQUE INDEX "RendezVous_suiviToken_key" ON "RendezVous"("suiviToken");

-- CreateIndex
CREATE UNIQUE INDEX "RendezVous_numeroFacture_key" ON "RendezVous"("numeroFacture");

-- CreateIndex
CREATE UNIQUE INDEX "RendezVous_stripeSessionId_key" ON "RendezVous"("stripeSessionId");

-- CreateIndex
CREATE INDEX "RendezVous_operateurId_idx" ON "RendezVous"("operateurId");

-- CreateIndex
CREATE INDEX "RendezVous_dateHeure_idx" ON "RendezVous"("dateHeure");

-- CreateIndex
CREATE INDEX "RendezVous_statut_idx" ON "RendezVous"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "RendezVousOption_rendezVousId_optionId_key" ON "RendezVousOption"("rendezVousId", "optionId");

-- CreateIndex
CREATE INDEX "AffectationCandidat_rendezVousId_idx" ON "AffectationCandidat"("rendezVousId");

-- CreateIndex
CREATE UNIQUE INDEX "Devis_token_key" ON "Devis"("token");

-- CreateIndex
CREATE INDEX "Devis_statut_idx" ON "Devis"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "DepensesMensuelles_mois_key" ON "DepensesMensuelles"("mois");

-- CreateIndex
CREATE INDEX "Sms_createdAt_idx" ON "Sms"("createdAt");

-- CreateIndex
CREATE INDEX "JournalAudit_entite_entiteId_idx" ON "JournalAudit"("entite", "entiteId");

-- CreateIndex
CREATE INDEX "JournalAudit_createdAt_idx" ON "JournalAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_operateurId_fkey" FOREIGN KEY ("operateurId") REFERENCES "Operateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adresse" ADD CONSTRAINT "Adresse_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicule" ADD CONSTRAINT "Vehicule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id")ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operateur" ADD CONSTRAINT "Operateur_secteurId_fkey" FOREIGN KEY ("secteurId") REFERENCES "Secteur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackTarif" ADD CONSTRAINT "PackTarif_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_vehiculeId_fkey" FOREIGN KEY ("vehiculeId") REFERENCES "Vehicule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_adresseId_fkey" FOREIGN KEY ("adresseId") REFERENCES "Adresse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_secteurId_fkey" FOREIGN KEY ("secteurId") REFERENCES "Secteur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_operateurId_fkey" FOREIGN KEY ("operateurId") REFERENCES "Operateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVousOption" ADD CONSTRAINT "RendezVousOption_rendezVousId_fkey" FOREIGN KEY ("rendezVousId") REFERENCES "RendezVous"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVousOption" ADD CONSTRAINT "RendezVousOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffectationCandidat" ADD CONSTRAINT "AffectationCandidat_rendezVousId_fkey" FOREIGN KEY ("rendezVousId") REFERENCES "RendezVous"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffectationCandidat" ADD CONSTRAINT "AffectationCandidat_operateurId_fkey" FOREIGN KEY ("operateurId") REFERENCES "Operateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_creeParUtilisateurId_fkey" FOREIGN KEY ("creeParUtilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_rendezVousId_fkey" FOREIGN KEY ("rendezVousId") REFERENCES "RendezVous"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sms" ADD CONSTRAINT "Sms_rendezVousId_fkey" FOREIGN KEY ("rendezVousId") REFERENCES "RendezVous"("id") ON DELETE SET NULL ON UPDATE CASCADE;

