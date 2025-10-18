/*
  Warnings:

  - You are about to drop the column `adminShellAdjustment` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `totalShellsSpent` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "adminShellAdjustment",
DROP COLUMN "totalShellsSpent",
ADD COLUMN     "adminCurrencyAdjustment" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCurrencySpent" INTEGER NOT NULL DEFAULT 0;
