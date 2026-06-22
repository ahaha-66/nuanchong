import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { OrganizationRole, Prisma } from '@prisma/client';
import type { RequestActor } from '@nuanchong/contracts';
import { audit } from '../common/audit.service';
import { PrismaService, type ActorTransaction } from '../common/prisma.service';

type Question = { key: string; label: string; type: 'BOOLEAN' | 'SINGLE_CHOICE' | 'TEXT' | 'NUMBER'; required?: boolean; options?: string[] };

@Injectable()
export class FollowupsService {
  constructor(private readonly prisma: PrismaService) {}
  private async requireRole(tx: ActorTransaction, actor: RequestActor, roles: OrganizationRole[]) {
    if (!actor.organizationId) throw new ForbiddenException('Select an organization');
    const member = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: actor.organizationId, userId: actor.userId } } });
    if (!member || !roles.includes(member.role)) throw new ForbiddenException({ code: 'FORBIDDEN' });
    return member;
  }
  definitions(actor: RequestActor) {
    if (!actor.organizationId) throw new ForbiddenException('Select an organization');
    return this.prisma.withActor(actor, tx => tx.followupDefinition.findMany({ where: { organizationId: actor.organizationId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } }));
  }
  createDefinition(actor: RequestActor, input: { title: string; questions: Question[] }) {
    return this.prisma.withActor(actor, async tx => {
      await this.requireRole(tx, actor, ['ADMIN', 'VET', 'NURSE']);
      const definition = await tx.followupDefinition.create({ data: { organizationId: actor.organizationId!, title: input.title, questionSchema: input.questions as unknown as Prisma.InputJsonValue, createdById: actor.userId } });
      await audit(tx, actor, 'FOLLOWUP_DEFINITION_CREATED', 'followup_definition', definition.id);
      return definition;
    });
  }
  create(actor: RequestActor, input: { petId: string; definitionId: string; scheduledAt: string; expiresAt: string }) {
    return this.prisma.withActor(actor, async tx => {
      await this.requireRole(tx, actor, ['ADMIN', 'VET', 'NURSE', 'CUSTOMER_SERVICE']);
      const definition = await tx.followupDefinition.findFirst({ where: { id: input.definitionId, organizationId: actor.organizationId, status: 'ACTIVE' } });
      if (!definition) throw new NotFoundException({ code: 'NOT_FOUND' });
      const scheduledAt = new Date(input.scheduledAt);
      const status = scheduledAt <= new Date() ? 'SENT' : 'SCHEDULED';
      const followup = await tx.followupInstance.create({ data: { petId: input.petId, organizationId: actor.organizationId!, definitionId: definition.id, definitionVersion: definition.version, scheduledAt, expiresAt: new Date(input.expiresAt), status, sentAt: status === 'SENT' ? new Date() : undefined } });
      await audit(tx, actor, 'FOLLOWUP_REQUESTED', 'followup_instance', followup.id);
      return followup;
    });
  }
  forPet(actor: RequestActor, petId: string) {
    return this.prisma.withActor(actor, tx => tx.followupInstance.findMany({ where: { petId }, include: { definition: true }, orderBy: { scheduledAt: 'desc' } }));
  }
  queue(actor: RequestActor) {
    if (!actor.organizationId) throw new ForbiddenException('Select an organization');
    return this.prisma.withActor(actor, async tx => {
      await this.requireRole(tx, actor, ['ADMIN', 'VET', 'NURSE', 'CUSTOMER_SERVICE', 'READ_ONLY']);
      return tx.followupInstance.findMany({ where: { organizationId: actor.organizationId, status: { in: ['SCHEDULED', 'SENT', 'SUBMITTED', 'CLAIMED'] } }, include: { pet: true, definition: true }, orderBy: [{ status: 'desc' }, { scheduledAt: 'asc' }] });
    });
  }
  get(actor: RequestActor, id: string) {
    return this.prisma.withActor(actor, async tx => {
      const followup = await tx.followupInstance.findUnique({ where: { id }, include: { pet: true, definition: true } });
      if (!followup) throw new NotFoundException({ code: 'NOT_FOUND' });
      return followup;
    });
  }
  submit(actor: RequestActor, id: string, input: { responses: Record<string, string | number | boolean | null> }) {
    return this.prisma.withActor(actor, async tx => {
      const followup = await tx.followupInstance.findUnique({ where: { id }, include: { definition: true } });
      if (!followup) throw new NotFoundException({ code: 'NOT_FOUND' });
      const member = await tx.petMember.findFirst({ where: { petId: followup.petId, userId: actor.userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
      if (!member) throw new ForbiddenException({ code: 'FORBIDDEN' });
      const questions = followup.definition.questionSchema as unknown as Question[];
      const missing = questions.filter(question => question.required !== false && (input.responses[question.key] === undefined || input.responses[question.key] === null || input.responses[question.key] === '')).map(question => question.key);
      if (missing.length) throw new BadRequestException({ code: 'VALIDATION_ERROR', fields: missing });
      const changed = await tx.followupInstance.updateMany({ where: { id, status: 'SENT', expiresAt: { gt: new Date() } }, data: { status: 'SUBMITTED', responsePayload: input.responses as Prisma.InputJsonValue, submittedAt: new Date() } });
      if (!changed.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      await tx.timelineEvent.create({ data: { petId: followup.petId, eventType: 'FOLLOWUP_SUBMITTED', occurredAt: new Date(), sourceType: 'FOLLOWUP', sourceId: id, summary: `已提交随访“${followup.definition.title}”` } });
      await audit(tx, actor, 'FOLLOWUP_SUBMITTED', 'followup_instance', id);
      return tx.followupInstance.findUnique({ where: { id }, include: { definition: true } });
    });
  }
  claim(actor: RequestActor, id: string) {
    return this.prisma.withActor(actor, async tx => {
      await this.requireRole(tx, actor, ['ADMIN', 'VET', 'NURSE', 'CUSTOMER_SERVICE']);
      const changed = await tx.followupInstance.updateMany({ where: { id, organizationId: actor.organizationId, status: 'SUBMITTED' }, data: { status: 'CLAIMED', assignedToId: actor.userId, claimedAt: new Date() } });
      if (!changed.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      await audit(tx, actor, 'FOLLOWUP_CLAIMED', 'followup_instance', id);
      return tx.followupInstance.findUnique({ where: { id }, include: { pet: true, definition: true } });
    });
  }
  complete(actor: RequestActor, id: string, input: { note: string; nextVisitAt?: string }) {
    return this.prisma.withActor(actor, async tx => {
      await this.requireRole(tx, actor, ['ADMIN', 'VET', 'NURSE', 'CUSTOMER_SERVICE']);
      const followup = await tx.followupInstance.findFirst({ where: { id, organizationId: actor.organizationId } });
      if (!followup) throw new NotFoundException({ code: 'NOT_FOUND' });
      if (followup.assignedToId !== actor.userId) throw new ForbiddenException('Only the claiming staff member can complete this follow-up');
      const changed = await tx.followupInstance.updateMany({ where: { id, status: 'CLAIMED', assignedToId: actor.userId }, data: { status: 'COMPLETED', completionNote: input.note, nextVisitAt: input.nextVisitAt ? new Date(input.nextVisitAt) : undefined, completedAt: new Date() } });
      if (!changed.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      await tx.timelineEvent.create({ data: { petId: followup.petId, eventType: 'FOLLOWUP_COMPLETED', occurredAt: new Date(), sourceType: 'FOLLOWUP', sourceId: id, summary: input.nextVisitAt ? `医院已完成随访，建议复诊时间 ${new Date(input.nextVisitAt).toLocaleDateString('zh-CN')}` : '医院已完成随访' } });
      await audit(tx, actor, 'FOLLOWUP_COMPLETED', 'followup_instance', id);
      return tx.followupInstance.findUnique({ where: { id }, include: { pet: true, definition: true } });
    });
  }
}
