-- AlterTable
ALTER TABLE "Devis" ADD COLUMN     "avecAcompte" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "fraisDeplacement" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "remisePourcent" DECIMAL(5,2) NOT NULL DEFAULT 0;

