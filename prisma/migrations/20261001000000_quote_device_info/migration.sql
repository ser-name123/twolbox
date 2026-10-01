-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "device" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ip" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "location" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Quote_ip_device_createdAt_idx" ON "Quote"("ip", "device", "createdAt");

