-- Add discount fields to ShopItem
ALTER TABLE "ShopItem"
  ADD COLUMN "discountPercent" INTEGER,
  ADD COLUMN "discountEndsAt" TIMESTAMP(3);


