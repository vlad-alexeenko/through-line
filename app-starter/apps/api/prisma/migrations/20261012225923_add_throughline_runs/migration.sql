-- CreateEnum
CREATE TYPE "ThroughlineRunKind" AS ENUM ('ANALYZE', 'APPROVE', 'REJECT');

-- CreateTable
CREATE TABLE "throughline_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "kind" "ThroughlineRunKind" NOT NULL,
    "analysis_id" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "throughline_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "throughline_runs_organization_id_idx" ON "throughline_runs"("organization_id");

-- CreateIndex
CREATE INDEX "throughline_runs_actor_id_idx" ON "throughline_runs"("actor_id");

-- AddForeignKey
ALTER TABLE "throughline_runs" ADD CONSTRAINT "throughline_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "throughline_runs" ADD CONSTRAINT "throughline_runs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
