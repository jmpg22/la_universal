-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "storeName" TEXT NOT NULL DEFAULT 'Abarrotes La Universal',
    "tagline" TEXT NOT NULL DEFAULT 'Todo lo de tu despensa, cerca de ti',
    "announcement" TEXT NOT NULL DEFAULT '',
    "heroTitle" TEXT NOT NULL DEFAULT 'Todo lo que necesitas en un solo lugar',
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
    "taglineEn" TEXT NOT NULL DEFAULT '',
    "announcementEn" TEXT NOT NULL DEFAULT '',
    "heroTitleEn" TEXT NOT NULL DEFAULT '',
    "heroSubtitleEn" TEXT NOT NULL DEFAULT '',
    "hoursEn" TEXT NOT NULL DEFAULT '',
    "deliveryAreaEn" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "bankAccountHolder" TEXT NOT NULL DEFAULT '',
    "bankAccount" TEXT NOT NULL DEFAULT '',
    "bankClabe" TEXT NOT NULL DEFAULT '',
    "bankCard" TEXT NOT NULL DEFAULT '',
    "bankNote" TEXT NOT NULL DEFAULT '',
    "botEnabled" BOOLEAN NOT NULL DEFAULT true,
    "botInstructions" TEXT NOT NULL DEFAULT '',
    "notifyCustomers" BOOLEAN NOT NULL DEFAULT true,
    "notifyStore" BOOLEAN NOT NULL DEFAULT true,
    "storeNotifyPhone" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Settings" ("acceptingOrders", "address", "announcement", "announcementEn", "bankAccount", "bankAccountHolder", "bankCard", "bankClabe", "bankName", "bankNote", "botEnabled", "botInstructions", "deliveryArea", "deliveryAreaEn", "deliveryEnabled", "deliveryFee", "email", "freeDeliveryMin", "heroSubtitle", "heroSubtitleEn", "heroTitle", "heroTitleEn", "hours", "hoursEn", "id", "minOrder", "notifyCustomers", "notifyStore", "phone", "pickupEnabled", "storeName", "storeNotifyPhone", "tagline", "taglineEn", "whatsapp") SELECT "acceptingOrders", "address", "announcement", "announcementEn", "bankAccount", "bankAccountHolder", "bankCard", "bankClabe", "bankName", "bankNote", "botEnabled", "botInstructions", "deliveryArea", "deliveryAreaEn", "deliveryEnabled", "deliveryFee", "email", "freeDeliveryMin", "heroSubtitle", "heroSubtitleEn", "heroTitle", "heroTitleEn", "hours", "hoursEn", "id", "minOrder", "notifyCustomers", "notifyStore", "phone", "pickupEnabled", "storeName", "storeNotifyPhone", "tagline", "taglineEn", "whatsapp" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
