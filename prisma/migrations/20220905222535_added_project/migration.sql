-- CreateEnum
CREATE TYPE "STATE" AS ENUM ('CANCELLED', 'ACCEPTED', 'DELAYED', 'STARTED');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "studio" TEXT NOT NULL,
    "features" TEXT[],
    "devAmoun" INTEGER NOT NULL,
    "maxBudget" DOUBLE PRECISION NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "state" "STATE" NOT NULL DEFAULT 'STARTED',
    "clientId" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
