-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🛒',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Category" ("active", "createdAt", "emoji", "id", "name", "slug", "sortOrder") SELECT "active", "createdAt", "emoji", "id", "name", "slug", "sortOrder" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publicToken" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'ONLINE',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "deliveryType" TEXT NOT NULL DEFAULT 'PICKUP',
    "address" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "cashGivenWith" INTEGER,
    "recipientName" TEXT NOT NULL DEFAULT '',
    "locale" TEXT NOT NULL DEFAULT 'es',
    "customerId" INTEGER,
    "subtotal" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("address", "cashGivenWith", "channel", "createdAt", "customerId", "customerName", "deliveryFee", "deliveryType", "email", "id", "notes", "paymentMethod", "phone", "publicToken", "recipientName", "status", "subtotal", "total", "updatedAt") SELECT "address", "cashGivenWith", "channel", "createdAt", "customerId", "customerName", "deliveryFee", "deliveryType", "email", "id", "notes", "paymentMethod", "phone", "publicToken", "recipientName", "status", "subtotal", "total", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "descriptionEn" TEXT NOT NULL DEFAULT '',
    "sku" TEXT,
    "price" INTEGER NOT NULL,
    "compareAtPrice" INTEGER,
    "unit" TEXT NOT NULL DEFAULT 'pieza',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("active", "categoryId", "compareAtPrice", "createdAt", "description", "featured", "id", "imageUrl", "lowStockThreshold", "name", "price", "sku", "slug", "stock", "unit", "updatedAt") SELECT "active", "categoryId", "compareAtPrice", "createdAt", "description", "featured", "id", "imageUrl", "lowStockThreshold", "name", "price", "sku", "slug", "stock", "unit", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
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
    "taglineEn" TEXT NOT NULL DEFAULT '',
    "announcementEn" TEXT NOT NULL DEFAULT '',
    "heroTitleEn" TEXT NOT NULL DEFAULT '',
    "heroSubtitleEn" TEXT NOT NULL DEFAULT '',
    "hoursEn" TEXT NOT NULL DEFAULT '',
    "deliveryAreaEn" TEXT NOT NULL DEFAULT '',
    "botEnabled" BOOLEAN NOT NULL DEFAULT true,
    "botInstructions" TEXT NOT NULL DEFAULT '',
    "notifyCustomers" BOOLEAN NOT NULL DEFAULT true,
    "notifyStore" BOOLEAN NOT NULL DEFAULT true,
    "storeNotifyPhone" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Settings" ("acceptingOrders", "address", "announcement", "botEnabled", "botInstructions", "deliveryArea", "deliveryEnabled", "deliveryFee", "email", "freeDeliveryMin", "heroSubtitle", "heroTitle", "hours", "id", "minOrder", "notifyCustomers", "notifyStore", "phone", "pickupEnabled", "storeName", "storeNotifyPhone", "tagline", "whatsapp") SELECT "acceptingOrders", "address", "announcement", "botEnabled", "botInstructions", "deliveryArea", "deliveryEnabled", "deliveryFee", "email", "freeDeliveryMin", "heroSubtitle", "heroTitle", "hours", "id", "minOrder", "notifyCustomers", "notifyStore", "phone", "pickupEnabled", "storeName", "storeNotifyPhone", "tagline", "whatsapp" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
