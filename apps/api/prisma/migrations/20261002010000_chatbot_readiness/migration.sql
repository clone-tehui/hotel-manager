CREATE TYPE "StayDurationUnit" AS ENUM ('DAY', 'MONTH', 'YEAR');

CREATE TYPE "RoomHoldStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'RELEASED', 'EXPIRED');

CREATE TABLE "room_holds" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "status" "RoomHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "discountRequested" BOOLEAN NOT NULL DEFAULT false,
    "basePricePerNightSnapshot" DECIMAL(12,2) NOT NULL,
    "discountRuleIdSnapshot" TEXT,
    "discountPerNightSnapshot" DECIMAL(12,2) NOT NULL,
    "finalPricePerNightSnapshot" DECIMAL(12,2) NOT NULL,
    "totalNightsSnapshot" INTEGER NOT NULL,
    "totalDiscountSnapshot" DECIMAL(12,2) NOT NULL,
    "totalAmountSnapshot" DECIMAL(12,2) NOT NULL,
    "customerRef" TEXT,
    "conversationRef" TEXT,
    "channelType" TEXT,
    "externalThreadId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "reservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_holds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chatbot_idempotencies" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatbot_idempotencies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "room_type_stay_discount_rules" (
    "id" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "minValue" INTEGER NOT NULL,
    "minUnit" "StayDurationUnit" NOT NULL,
    "maxValue" INTEGER,
    "maxUnit" "StayDurationUnit",
    "minNights" INTEGER NOT NULL,
    "maxNights" INTEGER,
    "discountPerNight" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_type_stay_discount_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "room_holds_reservationId_key" ON "room_holds"("reservationId");

CREATE INDEX "room_holds_roomId_status_expiresAt_checkInDate_checkOutDate_idx" ON "room_holds"("roomId", "status", "expiresAt", "checkInDate", "checkOutDate");

CREATE INDEX "room_holds_apiKeyId_id_idx" ON "room_holds"("apiKeyId", "id");

CREATE INDEX "chatbot_idempotencies_expiresAt_idx" ON "chatbot_idempotencies"("expiresAt");

CREATE UNIQUE INDEX "chatbot_idempotencies_apiKeyId_operation_key_key" ON "chatbot_idempotencies"("apiKeyId", "operation", "key");

CREATE INDEX "room_type_stay_discount_rules_roomTypeId_isActive_minNights_idx" ON "room_type_stay_discount_rules"("roomTypeId", "isActive", "minNights", "maxNights");

ALTER TABLE "room_holds" ADD CONSTRAINT "room_holds_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_holds" ADD CONSTRAINT "room_holds_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chatbot_idempotencies" ADD CONSTRAINT "chatbot_idempotencies_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_type_stay_discount_rules" ADD CONSTRAINT "room_type_stay_discount_rules_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE room_type_stay_discount_rules ADD CONSTRAINT stay_discount_bounds_check CHECK (
  "minValue" >= 1 AND "minNights" >= 1 AND "discountPerNight" >= 0 AND
  (("maxValue" IS NULL AND "maxUnit" IS NULL AND "maxNights" IS NULL) OR
  ("maxValue" >= 1 AND "maxUnit" IS NOT NULL AND "maxNights" >= "minNights"))
);
ALTER TABLE room_holds ADD CONSTRAINT room_hold_stay_check CHECK ("checkOutDate" > "checkInDate" AND "totalNightsSnapshot" >= 1);
ALTER TABLE room_holds ADD CONSTRAINT room_hold_price_check CHECK (
  "basePricePerNightSnapshot" > 0 AND "discountPerNightSnapshot" >= 0 AND "finalPricePerNightSnapshot" > 0
  AND "totalDiscountSnapshot" >= 0 AND "totalAmountSnapshot" > 0
);
