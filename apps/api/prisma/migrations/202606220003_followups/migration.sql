CREATE TYPE "FollowupStatus" AS ENUM ('SCHEDULED', 'SENT', 'SUBMITTED', 'CLAIMED', 'COMPLETED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "followup_definitions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "question_schema" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "followup_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "followup_instances" (
  "id" UUID NOT NULL,
  "pet_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "definition_id" UUID NOT NULL,
  "definition_version" INTEGER NOT NULL,
  "status" "FollowupStatus" NOT NULL DEFAULT 'SCHEDULED',
  "assigned_to_id" UUID,
  "scheduled_at" TIMESTAMPTZ NOT NULL,
  "sent_at" TIMESTAMPTZ,
  "submitted_at" TIMESTAMPTZ,
  "claimed_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "response_payload" JSONB,
  "completion_note" TEXT,
  "next_visit_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "followup_instances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "followup_definitions_organization_id_status_idx" ON "followup_definitions"("organization_id", "status");
CREATE INDEX "followup_instances_organization_id_status_scheduled_at_idx" ON "followup_instances"("organization_id", "status", "scheduled_at");
CREATE INDEX "followup_instances_pet_id_status_idx" ON "followup_instances"("pet_id", "status");

ALTER TABLE "followup_definitions" ADD CONSTRAINT "followup_definitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "followup_instances" ADD CONSTRAINT "followup_instances_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "followup_instances" ADD CONSTRAINT "followup_instances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "followup_instances" ADD CONSTRAINT "followup_instances_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "followup_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "followup_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "followup_instances" ENABLE ROW LEVEL SECURITY;

CREATE POLICY followup_definitions_org_all ON followup_definitions FOR ALL
  USING (app_is_organization_member(organization_id))
  WITH CHECK (app_is_organization_member(organization_id));

CREATE POLICY followups_select ON followup_instances FOR SELECT USING (
  app_is_pet_member(pet_id) OR (app_is_organization_member(organization_id) AND app_has_consent(pet_id, 'TIMELINE')) OR app_has_support_access(pet_id)
);
CREATE POLICY followups_org_insert ON followup_instances FOR INSERT WITH CHECK (
  app_is_organization_member(organization_id) AND app_has_consent(pet_id, 'TIMELINE')
);
CREATE POLICY followups_org_update ON followup_instances FOR UPDATE USING (
  app_is_organization_member(organization_id) AND app_has_consent(pet_id, 'TIMELINE')
) WITH CHECK (app_is_organization_member(organization_id) AND app_has_consent(pet_id, 'TIMELINE'));
CREATE POLICY followups_pet_update ON followup_instances FOR UPDATE USING (app_is_pet_member(pet_id)) WITH CHECK (app_is_pet_member(pet_id));
CREATE POLICY timeline_org_insert ON timeline_events FOR INSERT WITH CHECK (app_has_consent(pet_id, 'TIMELINE'));
