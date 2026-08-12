-- CreateTable
CREATE TABLE "settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);
