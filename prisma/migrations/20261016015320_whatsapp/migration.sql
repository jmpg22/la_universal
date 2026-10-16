-- CreateTable
CREATE TABLE "WhatsAppConversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "waId" TEXT NOT NULL,
    "phoneKey" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "botPaused" BOOLEAN NOT NULL DEFAULT false,
    "draft" TEXT NOT NULL DEFAULT '{}',
    "unread" INTEGER NOT NULL DEFAULT 0,
    "lastInboundAt" DATETIME,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "waMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "storeName" TEXT NOT NULL DEFAULT 'Abarrotes La Universal',
    "tagline" TEXT NOT NULL DEFAULT 'Todo lo de tu despensa, cerca de ti',
    "announcement" TEXT NOT NULL DEFAULT '',
    "heroTitle" TEXT NOT NULL DEFAULT 'Tu tiendita de confianza, ahora en línea',
    "heroSubtitle" TEXT NOT NULL DEFAULT 'Haz tu pedido y pásalo a recoger o te lo llevamos a casa.',
    "phone" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "hours" TEXT NOT NULL DEFAULT 'Lunes a domingo, 7:00 a 22:00',
    "acceptingOrders" BOOLEAN NOT NULL DEFAULT true,
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deliveryFee" INTEGER NOT NULL DEFAULT 3000,
    "freeDeliveryMin" INTEGER NOT NULL DEFAULT 30000,
    "minOrder" INTEGER NOT NULL DEFAULT 0,
    "deliveryArea" TEXT NOT NULL DEFAULT 'Colonias cercanas a la tienda',
    "botEnabled" BOOLEAN NOT NULL DEFAULT true,
    "botInstructions" TEXT NOT NULL DEFAULT '',
    "notifyCustomers" BOOLEAN NOT NULL DEFAULT true,
    "notifyStore" BOOLEAN NOT NULL DEFAULT true,
    "storeNotifyPhone" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Settings" ("acceptingOrders", "address", "announcement", "deliveryArea", "deliveryEnabled", "deliveryFee", "email", "freeDeliveryMin", "heroSubtitle", "heroTitle", "hours", "id", "minOrder", "phone", "pickupEnabled", "storeName", "tagline", "whatsapp") SELECT "acceptingOrders", "address", "announcement", "deliveryArea", "deliveryEnabled", "deliveryFee", "email", "freeDeliveryMin", "heroSubtitle", "heroTitle", "hours", "id", "minOrder", "phone", "pickupEnabled", "storeName", "tagline", "whatsapp" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConversation_waId_key" ON "WhatsAppConversation"("waId");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_phoneKey_idx" ON "WhatsAppConversation"("phoneKey");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_lastMessageAt_idx" ON "WhatsAppConversation"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_waMessageId_key" ON "WhatsAppMessage"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_conversationId_createdAt_idx" ON "WhatsAppMessage"("conversationId", "createdAt");
