-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PhotoSlot" ADD VALUE 'SIDE_LEFT';
ALTER TYPE "PhotoSlot" ADD VALUE 'SIDE_RIGHT';
ALTER TYPE "PhotoSlot" ADD VALUE 'INTERIOR_REAR';
ALTER TYPE "PhotoSlot" ADD VALUE 'TRUNK';

