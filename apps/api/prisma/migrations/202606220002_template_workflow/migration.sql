CREATE TYPE "TemplateReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'RETIRED');

ALTER TABLE "care_templates"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "disease_tag" TEXT,
  ADD COLUMN "description" TEXT;

ALTER TABLE "template_versions"
  ADD COLUMN "created_by_id" UUID,
  ADD COLUMN "review_status" "TemplateReviewStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "reviewer_id" UUID,
  ADD COLUMN "review_note" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMPTZ,
  ADD COLUMN "published_at" TIMESTAMPTZ;

CREATE INDEX "care_templates_organization_id_category_idx" ON "care_templates"("organization_id", "category");
CREATE INDEX "template_versions_review_status_idx" ON "template_versions"("review_status");
