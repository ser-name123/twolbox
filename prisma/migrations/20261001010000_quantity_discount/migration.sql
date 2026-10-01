-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "qtyDiscount" JSONB;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "ignoreGroupDiscount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qtyDiscount" JSONB;

