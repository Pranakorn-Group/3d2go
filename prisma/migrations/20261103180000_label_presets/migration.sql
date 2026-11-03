-- Saved A4 roll-label layouts, shared by everyone printing labels.

CREATE TABLE "LabelPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabelPreset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LabelPreset_name_key" ON "LabelPreset"("name");
