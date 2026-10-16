-- AlterTable
ALTER TABLE "Order" ADD COLUMN "deliveredAt" DATETIME;

-- CreateTable
CREATE TABLE "CashSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedBy" TEXT NOT NULL,
    "openingCash" INTEGER NOT NULL,
    "closedAt" DATETIME,
    "closedBy" TEXT NOT NULL DEFAULT '',
    "salesCount" INTEGER,
    "salesCash" INTEGER,
    "salesCard" INTEGER,
    "salesTransfer" INTEGER,
    "discounts" INTEGER,
    "expectedCash" INTEGER,
    "countedCash" INTEGER,
    "difference" INTEGER,
    "notes" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashMovement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CashSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CashMovement_sessionId_idx" ON "CashMovement"("sessionId");

-- CreateIndex
CREATE INDEX "Order_deliveredAt_idx" ON "Order"("deliveredAt");
