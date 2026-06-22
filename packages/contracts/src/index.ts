import { z } from 'zod';

export const ErrorCode = {
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  Validation: 'VALIDATION_ERROR',
  ConsentRequired: 'CONSENT_REQUIRED',
  VersionConflict: 'VERSION_CONFLICT',
} as const;

export const PetRoleSchema = z.enum(['OWNER', 'FAMILY', 'TEMP_CARER', 'VIEWER']);
export const OrganizationRoleSchema = z.enum(['ADMIN', 'VET', 'NURSE', 'CUSTOMER_SERVICE', 'READ_ONLY']);
export const CarePlanStatusSchema = z.enum(['DRAFT', 'PENDING_CONFIRMATION', 'ACTIVE', 'PAUSED', 'SUPERSEDED', 'COMPLETED', 'CANCELLED']);
export const TaskStatusSchema = z.enum(['PENDING', 'CLAIMED', 'COMPLETED', 'SKIPPED', 'ABNORMAL', 'OVERDUE']);

export const DevLoginSchema = z.object({ email: z.string().email(), displayName: z.string().min(1).max(80).optional() });
export const HospitalLoginSchema = z.object({ email: z.string().email(), password: z.string().min(8), organizationId: z.string().uuid().optional() });
export const RefreshSchema = z.object({ refreshToken: z.string().min(32) });
export const CreatePetSchema = z.object({ name: z.string().trim().min(1).max(50), species: z.enum(['CAT', 'DOG', 'OTHER']), birthDate: z.string().date().optional(), sex: z.enum(['MALE', 'FEMALE', 'UNKNOWN']).default('UNKNOWN') });
export const CreateObservationSchema = z.object({
  category: z.enum(['APPETITE', 'WATER', 'STOOL', 'URINE', 'ACTIVITY', 'SLEEP', 'PAIN', 'VOMIT', 'RESPIRATION', 'WEIGHT', 'WOUND', 'OTHER']),
  occurredAt: z.string().datetime().optional(),
  summary: z.string().trim().min(1).max(500),
  value: z.string().trim().max(100).optional(),
  unit: z.string().trim().max(30).optional(),
});
export const InvitationSchema = z.object({ email: z.string().email(), role: PetRoleSchema.exclude(['OWNER']), expiresAt: z.string().datetime().optional() }).superRefine((value, ctx) => {
  if (value.role === 'TEMP_CARER' && !value.expiresAt) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresAt'], message: 'Temporary carers require an expiry' });
});

export const TaskDefinitionSchema = z.object({
  title: z.string().min(1).max(100),
  kind: z.enum(['MEDICATION', 'FEEDING', 'MEASUREMENT', 'OBSERVATION', 'OTHER']),
  scheduleTimes: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1),
  startDate: z.string().date(),
  endDate: z.string().date(),
  instructions: z.string().max(500).optional(),
});
export const TemplateTaskSchema = z.object({
  title: z.string().trim().min(1).max(100),
  kind: z.enum(['MEDICATION', 'FEEDING', 'MEASUREMENT', 'OBSERVATION', 'OTHER']),
  defaultTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  instructions: z.string().trim().max(500),
});
export const TemplateContentSchema = z.object({
  applicableConditions: z.array(z.string().trim().min(1).max(100)).min(1),
  contraindications: z.array(z.string().trim().min(1).max(200)).default([]),
  observationFocus: z.array(z.string().trim().min(1).max(100)).min(1).max(5),
  tasks: z.array(TemplateTaskSchema).min(1).max(20),
  disclaimer: z.string().trim().min(1).max(500),
});
export const CreateTemplateSchema = z.object({ name: z.string().trim().min(1).max(100), category: z.string().trim().min(1).max(50), diseaseTag: z.string().trim().max(80).optional(), description: z.string().trim().max(500).optional(), content: TemplateContentSchema });
export const CreateTemplateVersionSchema = z.object({ content: TemplateContentSchema });
export const ReviewTemplateSchema = z.object({ approved: z.boolean(), note: z.string().trim().min(1).max(500) });
export const FollowupQuestionSchema = z.object({ key: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/), label: z.string().trim().min(1).max(100), type: z.enum(['BOOLEAN', 'SINGLE_CHOICE', 'TEXT', 'NUMBER']), required: z.boolean().default(true), options: z.array(z.string().trim().min(1).max(50)).max(10).optional() });
export const CreateFollowupDefinitionSchema = z.object({ title: z.string().trim().min(1).max(100), questions: z.array(FollowupQuestionSchema).min(1).max(20) });
export const CreateFollowupSchema = z.object({ petId: z.string().uuid(), definitionId: z.string().uuid(), scheduledAt: z.string().datetime(), expiresAt: z.string().datetime() }).refine(value => new Date(value.expiresAt) > new Date(value.scheduledAt), { message: 'Expiry must be after scheduled time', path: ['expiresAt'] });
export const SubmitFollowupSchema = z.object({ responses: z.record(z.union([z.string().max(1000), z.number(), z.boolean(), z.null()])) });
export const CompleteFollowupSchema = z.object({ note: z.string().trim().min(1).max(1000), nextVisitAt: z.string().datetime().optional() });
export const CreateCarePlanSchema = z.object({ petId: z.string().uuid(), title: z.string().min(1).max(100), timezone: z.string().default('Asia/Shanghai'), tasks: z.array(TaskDefinitionSchema).min(1) });
export const VersionSchema = z.object({ version: z.number().int().positive() });
export const CompleteTaskSchema = VersionSchema.extend({ outcome: z.enum(['COMPLETED', 'SKIPPED', 'ABNORMAL']), note: z.string().max(500).optional() });
export const CorrectTaskSchema = z.object({ note: z.string().min(1).max(500), outcome: z.enum(['COMPLETED', 'SKIPPED', 'ABNORMAL']) });

export const ConsentScopeSchema = z.enum(['CARE_PLAN', 'TASK_EXECUTIONS', 'OBSERVATIONS', 'TIMELINE']);
export const CreateConsentSchema = z.object({ petId: z.string().uuid(), organizationId: z.string().uuid(), scopes: z.array(ConsentScopeSchema).min(1), startsAt: z.string().datetime(), endsAt: z.string().datetime() });

export const ExtractionFieldSchema = z.object({ value: z.union([z.string(), z.number(), z.boolean(), z.null()]), evidence: z.string(), confidence: z.number().min(0).max(1) });
export const ExtractionResultSchema = z.object({
  category: z.enum(['APPETITE', 'WATER', 'VOMIT', 'STOOL', 'ACTIVITY', 'PAIN', 'MEDICATION_CANDIDATE', 'OTHER']),
  occurredAt: ExtractionFieldSchema,
  summary: ExtractionFieldSchema,
  value: ExtractionFieldSchema.optional(),
  unit: ExtractionFieldSchema.optional(),
  candidateTaskId: z.string().uuid().nullable().optional(),
  safetyNotice: z.string().optional(),
});
export const CreateExtractionSchema = z.object({ petId: z.string().uuid(), text: z.string().min(1).max(5000), mediaAssetId: z.string().uuid().optional() });
export const ConfirmExtractionSchema = z.object({ result: ExtractionResultSchema });

export type RequestActor = { userId: string; organizationId?: string; supportAccessId?: string; roles?: string[] };
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
