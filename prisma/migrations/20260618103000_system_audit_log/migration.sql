-- CreateTable
CREATE TABLE "SystemAuditLog" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemAuditLog_actor_user_id_created_at_idx" ON "SystemAuditLog"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "SystemAuditLog_target_type_target_id_created_at_idx" ON "SystemAuditLog"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "SystemAuditLog_action_created_at_idx" ON "SystemAuditLog"("action", "created_at");

-- CreateIndex
CREATE INDEX "SystemAuditLog_created_at_idx" ON "SystemAuditLog"("created_at");

-- AddForeignKey
ALTER TABLE "SystemAuditLog" ADD CONSTRAINT "SystemAuditLog_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
