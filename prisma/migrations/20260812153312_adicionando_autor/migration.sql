/*
  Warnings:

  - Made the column `dataRegistro` on table `elogios_motoristas` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "elogios_internos" ADD COLUMN     "autor" TEXT;

-- AlterTable
ALTER TABLE "elogios_motoristas" ALTER COLUMN "dataRegistro" SET NOT NULL;
