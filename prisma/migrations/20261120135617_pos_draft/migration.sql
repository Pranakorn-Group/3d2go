-- CreateTable
CREATE TABLE "PosDraft" (
    "userId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosDraft_pkey" PRIMARY KEY ("userId")
);
