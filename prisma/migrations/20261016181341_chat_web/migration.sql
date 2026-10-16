-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WhatsAppConversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "webToken" TEXT,
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
INSERT INTO "new_WhatsAppConversation" ("botPaused", "createdAt", "draft", "id", "lastInboundAt", "lastMessageAt", "name", "phoneKey", "unread", "waId") SELECT "botPaused", "createdAt", "draft", "id", "lastInboundAt", "lastMessageAt", "name", "phoneKey", "unread", "waId" FROM "WhatsAppConversation";
DROP TABLE "WhatsAppConversation";
ALTER TABLE "new_WhatsAppConversation" RENAME TO "WhatsAppConversation";
CREATE UNIQUE INDEX "WhatsAppConversation_webToken_key" ON "WhatsAppConversation"("webToken");
CREATE UNIQUE INDEX "WhatsAppConversation_waId_key" ON "WhatsAppConversation"("waId");
CREATE INDEX "WhatsAppConversation_phoneKey_idx" ON "WhatsAppConversation"("phoneKey");
CREATE INDEX "WhatsAppConversation_lastMessageAt_idx" ON "WhatsAppConversation"("lastMessageAt");
CREATE TABLE "new_WhatsAppMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "waMessageId" TEXT,
    "meta" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WhatsAppMessage" ("body", "conversationId", "createdAt", "direction", "error", "id", "sender", "status", "waMessageId") SELECT "body", "conversationId", "createdAt", "direction", "error", "id", "sender", "status", "waMessageId" FROM "WhatsAppMessage";
DROP TABLE "WhatsAppMessage";
ALTER TABLE "new_WhatsAppMessage" RENAME TO "WhatsAppMessage";
CREATE UNIQUE INDEX "WhatsAppMessage_waMessageId_key" ON "WhatsAppMessage"("waMessageId");
CREATE INDEX "WhatsAppMessage_conversationId_createdAt_idx" ON "WhatsAppMessage"("conversationId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
