-- CreateTable
CREATE TABLE "GuestUser" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "docsGenerated" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestUser_guestId_key" ON "GuestUser"("guestId");

-- CreateIndex
CREATE INDEX "GuestUser_createdAt_idx" ON "GuestUser"("createdAt");

-- CreateIndex
CREATE INDEX "GuestUser_lastActiveAt_idx" ON "GuestUser"("lastActiveAt");
