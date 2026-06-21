-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PetSpecies" AS ENUM ('CAT', 'DOG', 'OTHER');

-- CreateEnum
CREATE TYPE "PetSex" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PetRole" AS ENUM ('OWNER', 'FAMILY', 'TEMP_CARER', 'VIEWER');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('ADMIN', 'VET', 'NURSE', 'CUSTOMER_SERVICE', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'PENDING_CONFIRMATION', 'ACTIVE', 'PAUSED', 'SUPERSEDED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('MEDICATION', 'FEEDING', 'MEASUREMENT', 'OBSERVATION', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'CLAIMED', 'COMPLETED', 'SKIPPED', 'ABNORMAL', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('QUEUED', 'PROCESSING', 'NEEDS_CONFIRMATION', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConsentScope" AS ENUM ('CARE_PLAN', 'TASK_EXECUTIONS', 'OBSERVATIONS', 'TIMELINE');

-- CreateEnum
CREATE TYPE "SupportAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "displayName" TEXT NOT NULL,
    "password_hash" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "species" "PetSpecies" NOT NULL,
    "sex" "PetSex" NOT NULL DEFAULT 'UNKNOWN',
    "birth_date" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_members" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "PetRole" NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pet_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_invitations" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "PetRole" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_plans" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "current_plan_version_id" UUID,
    "created_by_id" UUID NOT NULL,
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "care_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_versions" (
    "id" UUID NOT NULL,
    "care_plan_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "requires_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_definitions" (
    "id" UUID NOT NULL,
    "care_plan_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "TaskKind" NOT NULL,
    "schedule_times" TEXT[],
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "instructions" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_instances" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "task_definition_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "claimed_by_id" UUID,
    "claimed_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "task_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_executions" (
    "id" UUID NOT NULL,
    "task_instance_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "outcome" "TaskStatus" NOT NULL,
    "note" TEXT,
    "corrects_execution_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation_definitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observation_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation_records" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "summary" TEXT NOT NULL,
    "value" TEXT,
    "unit" TEXT,
    "source_extraction_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_extractions" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "media_asset_id" UUID,
    "source_text" TEXT NOT NULL,
    "transcript" TEXT,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'QUEUED',
    "result" JSONB,
    "model" TEXT,
    "prompt_version" TEXT NOT NULL DEFAULT 'observation-v1',
    "schema_version" TEXT NOT NULL DEFAULT '1',
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_events" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_grants" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "granted_by_id" UUID NOT NULL,
    "scopes" "ConsentScope"[],
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "checksum" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "organization_id" UUID,
    "support_access_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID,
    "outcome" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_access_requests" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "approver_id" UUID,
    "pet_id" UUID,
    "resource_type" TEXT,
    "resource_id" UUID,
    "reason" TEXT NOT NULL,
    "status" "SupportAccessStatus" NOT NULL DEFAULT 'PENDING',
    "approved_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_versions" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_subject_key" ON "auth_identities"("provider", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pet_members_pet_id_user_id_key" ON "pet_members"("pet_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_invitations_token_hash_key" ON "member_invitations"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "plan_versions_care_plan_id_number_key" ON "plan_versions"("care_plan_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "task_instances_task_definition_id_scheduled_at_pet_id_key" ON "task_instances"("task_definition_id", "scheduled_at", "pet_id");

-- CreateIndex
CREATE INDEX "timeline_events_pet_id_occurred_at_idx" ON "timeline_events"("pet_id", "occurred_at");

-- CreateIndex
CREATE INDEX "consent_grants_pet_id_organization_id_idx" ON "consent_grants"("pet_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_object_key_key" ON "media_assets"("object_key");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_actor_user_id_key_route_key" ON "idempotency_records"("actor_user_id", "key", "route");

-- CreateIndex
CREATE UNIQUE INDEX "template_versions_template_id_number_key" ON "template_versions"("template_id", "number");

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_members" ADD CONSTRAINT "pet_members_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_members" ADD CONSTRAINT "pet_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_care_plan_id_fkey" FOREIGN KEY ("care_plan_id") REFERENCES "care_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_definitions" ADD CONSTRAINT "task_definitions_care_plan_id_fkey" FOREIGN KEY ("care_plan_id") REFERENCES "care_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_definitions" ADD CONSTRAINT "task_definitions_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_task_definition_id_fkey" FOREIGN KEY ("task_definition_id") REFERENCES "task_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_task_instance_id_fkey" FOREIGN KEY ("task_instance_id") REFERENCES "task_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_records" ADD CONSTRAINT "observation_records_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "care_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Runtime grants. The application role owns no table and cannot bypass RLS.
GRANT USAGE ON SCHEMA public TO nuanchong_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nuanchong_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nuanchong_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nuanchong_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO nuanchong_app;

CREATE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;
CREATE FUNCTION app_organization_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid
$$;

CREATE FUNCTION app_is_pet_member(target_pet_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM pet_members pm
    WHERE pm.pet_id = target_pet_id
      AND pm.user_id = app_user_id()
      AND (pm.expires_at IS NULL OR pm.expires_at > now())
  )
$$;
CREATE FUNCTION app_is_pet_owner(target_pet_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM pet_members pm
    WHERE pm.pet_id = target_pet_id AND pm.user_id = app_user_id()
      AND pm.role = 'OWNER' AND (pm.expires_at IS NULL OR pm.expires_at > now())
  )
$$;
CREATE FUNCTION app_is_organization_member(target_organization_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = target_organization_id AND om.user_id = app_user_id()
      AND target_organization_id = app_organization_id()
  )
$$;
CREATE FUNCTION app_has_consent(target_pet_id uuid, needed_scope "ConsentScope") RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM consent_grants cg
    WHERE cg.pet_id = target_pet_id
      AND cg.organization_id = app_organization_id()
      AND needed_scope = ANY(cg.scopes)
      AND cg.revoked_at IS NULL AND cg.starts_at <= now() AND cg.ends_at > now()
      AND app_is_organization_member(cg.organization_id)
  )
$$;
CREATE FUNCTION app_has_support_access(target_pet_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM support_access_requests sar
    WHERE sar.id = NULLIF(current_setting('app.support_access_id', true), '')::uuid
      AND sar.status = 'APPROVED' AND sar.approver_id IS NOT NULL
      AND sar.requester_id = app_user_id() AND sar.approver_id <> sar.requester_id
      AND sar.expires_at > now() AND sar.expires_at <= sar.approved_at + interval '30 minutes'
      AND (sar.pet_id IS NULL OR sar.pet_id = target_pet_id)
  )
$$;

REVOKE ALL ON FUNCTION app_is_pet_member(uuid), app_is_pet_owner(uuid), app_is_organization_member(uuid), app_has_consent(uuid, "ConsentScope"), app_has_support_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_is_pet_member(uuid), app_is_pet_owner(uuid), app_is_organization_member(uuid), app_has_consent(uuid, "ConsentScope"), app_has_support_access(uuid) TO nuanchong_app;

ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE observation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY pets_member_select ON pets FOR SELECT USING (
  app_is_pet_member(id) OR app_has_consent(id, 'CARE_PLAN') OR app_has_consent(id, 'TASK_EXECUTIONS') OR app_has_consent(id, 'OBSERVATIONS') OR app_has_consent(id, 'TIMELINE') OR app_has_support_access(id)
);
CREATE POLICY pets_member_insert ON pets FOR INSERT WITH CHECK (app_user_id() IS NOT NULL);
CREATE POLICY pets_owner_update ON pets FOR UPDATE USING (app_is_pet_owner(id)) WITH CHECK (app_is_pet_owner(id));

CREATE POLICY pet_members_visible ON pet_members FOR SELECT USING (app_is_pet_member(pet_id));
CREATE POLICY pet_members_owner_insert ON pet_members FOR INSERT WITH CHECK (user_id = app_user_id() OR app_is_pet_owner(pet_id));
CREATE POLICY pet_members_owner_update ON pet_members FOR UPDATE USING (app_is_pet_owner(pet_id)) WITH CHECK (app_is_pet_owner(pet_id));
CREATE POLICY pet_members_owner_delete ON pet_members FOR DELETE USING (app_is_pet_owner(pet_id));

CREATE POLICY invitations_owner_all ON member_invitations FOR ALL USING (app_is_pet_owner(pet_id)) WITH CHECK (app_is_pet_owner(pet_id));
CREATE POLICY organizations_member_select ON organizations FOR SELECT USING (app_is_organization_member(id));
CREATE POLICY organization_members_visible ON organization_members FOR SELECT USING (app_is_organization_member(organization_id));

CREATE POLICY care_plans_select ON care_plans FOR SELECT USING (app_is_pet_member(pet_id) OR (app_is_organization_member(organization_id) AND app_has_consent(pet_id, 'CARE_PLAN')) OR app_has_support_access(pet_id));
CREATE POLICY care_plans_org_insert ON care_plans FOR INSERT WITH CHECK (app_is_organization_member(organization_id) AND app_has_consent(pet_id, 'CARE_PLAN'));
CREATE POLICY care_plans_change ON care_plans FOR UPDATE USING (app_is_pet_owner(pet_id) OR (app_is_organization_member(organization_id) AND app_has_consent(pet_id, 'CARE_PLAN')));
CREATE POLICY plan_versions_select ON plan_versions FOR SELECT USING (EXISTS (SELECT 1 FROM care_plans cp WHERE cp.id = care_plan_id));
CREATE POLICY plan_versions_org_insert ON plan_versions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM care_plans cp WHERE cp.id = care_plan_id AND app_is_organization_member(cp.organization_id)));
CREATE POLICY task_definitions_select ON task_definitions FOR SELECT USING (EXISTS (SELECT 1 FROM care_plans cp WHERE cp.id = care_plan_id));
CREATE POLICY task_definitions_org_insert ON task_definitions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM care_plans cp WHERE cp.id = care_plan_id AND app_is_organization_member(cp.organization_id)));

CREATE POLICY task_instances_select ON task_instances FOR SELECT USING (app_is_pet_member(pet_id) OR app_has_consent(pet_id, 'TASK_EXECUTIONS') OR app_has_support_access(pet_id));
CREATE POLICY task_instances_member_insert ON task_instances FOR INSERT WITH CHECK (app_is_pet_member(pet_id));
CREATE POLICY task_instances_member_update ON task_instances FOR UPDATE USING (app_is_pet_member(pet_id)) WITH CHECK (app_is_pet_member(pet_id));
CREATE POLICY task_executions_select ON task_executions FOR SELECT USING (EXISTS (SELECT 1 FROM task_instances ti WHERE ti.id = task_instance_id));
CREATE POLICY task_executions_member_insert ON task_executions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM task_instances ti WHERE ti.id = task_instance_id AND app_is_pet_member(ti.pet_id)));

CREATE POLICY observations_select ON observation_records FOR SELECT USING (app_is_pet_member(pet_id) OR app_has_consent(pet_id, 'OBSERVATIONS') OR app_has_support_access(pet_id));
CREATE POLICY observations_member_insert ON observation_records FOR INSERT WITH CHECK (app_is_pet_member(pet_id) AND actor_user_id = app_user_id());
CREATE POLICY ai_extractions_member_all ON ai_extractions FOR ALL USING (app_is_pet_member(pet_id) AND actor_user_id = app_user_id()) WITH CHECK (app_is_pet_member(pet_id) AND actor_user_id = app_user_id());
CREATE POLICY timeline_select ON timeline_events FOR SELECT USING (app_is_pet_member(pet_id) OR app_has_consent(pet_id, 'TIMELINE') OR app_has_support_access(pet_id));
CREATE POLICY timeline_member_insert ON timeline_events FOR INSERT WITH CHECK (app_is_pet_member(pet_id));

CREATE POLICY consents_owner_all ON consent_grants FOR ALL USING (app_is_pet_owner(pet_id)) WITH CHECK (app_is_pet_owner(pet_id) AND granted_by_id = app_user_id());
CREATE POLICY consents_org_select ON consent_grants FOR SELECT USING (app_is_organization_member(organization_id));
CREATE POLICY media_member_all ON media_assets FOR ALL USING (app_is_pet_member(pet_id)) WITH CHECK (app_is_pet_member(pet_id) AND owner_user_id = app_user_id());

CREATE POLICY care_templates_org_all ON care_templates FOR ALL USING (app_is_organization_member(organization_id)) WITH CHECK (app_is_organization_member(organization_id));
CREATE POLICY template_versions_org_all ON template_versions FOR ALL USING (EXISTS (SELECT 1 FROM care_templates ct WHERE ct.id = template_id)) WITH CHECK (EXISTS (SELECT 1 FROM care_templates ct WHERE ct.id = template_id));
CREATE POLICY audit_append_only ON audit_logs FOR INSERT WITH CHECK (actor_user_id = app_user_id());
CREATE POLICY support_request_own_select ON support_access_requests FOR SELECT USING (requester_id = app_user_id());
CREATE POLICY support_request_own_insert ON support_access_requests FOR INSERT WITH CHECK (requester_id = app_user_id() AND status = 'PENDING');
CREATE POLICY idempotency_own_all ON idempotency_records FOR ALL USING (actor_user_id = app_user_id()) WITH CHECK (actor_user_id = app_user_id());

REVOKE UPDATE, DELETE ON audit_logs FROM nuanchong_app;
REVOKE UPDATE, DELETE ON support_access_requests FROM nuanchong_app;
