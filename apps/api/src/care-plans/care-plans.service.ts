import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { RequestActor } from '@nuanchong/contracts';
import type { Prisma } from '@prisma/client';
import { audit } from '../common/audit.service';
import { PrismaService } from '../common/prisma.service';
import { generateTasks } from './task-generation';

type PlanInput = { petId: string; title: string; timezone?: string; tasks: Array<{ title: string; kind: 'MEDICATION' | 'FEEDING' | 'MEASUREMENT' | 'OBSERVATION' | 'OTHER'; scheduleTimes: string[]; startDate: string; endDate: string; instructions?: string }> };

@Injectable()
export class CarePlansService {
  constructor(private readonly prisma: PrismaService) {}
  listForPet(actor: RequestActor, petId: string) {
    return this.prisma.withActor(actor, tx => tx.carePlan.findMany({ where: { petId }, include: { taskDefinitions: true, versions: { orderBy: { number: 'desc' }, take: 1 } }, orderBy: { createdAt: 'desc' } }));
  }
  create(actor: RequestActor, input: PlanInput) {
    if (!actor.organizationId) throw new ForbiddenException('Select an organization');
    return this.prisma.withActor(actor, async tx => {
      const plan = await tx.carePlan.create({ data: { petId: input.petId, organizationId: actor.organizationId!, title: input.title, timezone: input.timezone ?? 'Asia/Shanghai', createdById: actor.userId } });
      const version = await tx.planVersion.create({ data: { carePlanId: plan.id, number: 1, snapshot: input as unknown as Prisma.InputJsonValue, requiresConfirmation: true } });
      await tx.carePlan.update({ where: { id: plan.id }, data: { currentPlanVersionId: version.id } });
      await tx.taskDefinition.createMany({ data: input.tasks.map(task => ({ carePlanId: plan.id, planVersionId: version.id, title: task.title, kind: task.kind, scheduleTimes: task.scheduleTimes, startDate: new Date(task.startDate), endDate: new Date(task.endDate), instructions: task.instructions })) });
      await audit(tx, actor, 'CARE_PLAN_CREATED', 'care_plan', plan.id);
      return tx.carePlan.findUnique({ where: { id: plan.id }, include: { taskDefinitions: true, versions: true } });
    });
  }
  publish(actor: RequestActor, id: string, expectedVersion: number) {
    return this.prisma.withActor(actor, async tx => {
      const updated = await tx.carePlan.updateMany({ where: { id, organizationId: actor.organizationId, status: 'DRAFT', version: expectedVersion }, data: { status: 'PENDING_CONFIRMATION', version: { increment: 1 } } });
      if (!updated.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      await audit(tx, actor, 'CARE_PLAN_PUBLISHED', 'care_plan', id);
      return tx.carePlan.findUnique({ where: { id } });
    });
  }
  confirm(actor: RequestActor, id: string, expectedVersion: number) {
    return this.prisma.withActor(actor, async tx => {
      const plan = await tx.carePlan.findUnique({ where: { id }, include: { taskDefinitions: true } });
      if (!plan) throw new NotFoundException({ code: 'NOT_FOUND' });
      const owner = await tx.petMember.findFirst({ where: { petId: plan.petId, userId: actor.userId, role: 'OWNER' } });
      if (!owner) throw new ForbiddenException({ code: 'FORBIDDEN' });
      const changed = await tx.carePlan.updateMany({ where: { id, status: 'PENDING_CONFIRMATION', version: expectedVersion }, data: { status: 'ACTIVE', confirmedById: actor.userId, confirmedAt: new Date(), version: { increment: 1 } } });
      if (!changed.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      const generated = generateTasks(plan.taskDefinitions.map(d => ({ id: d.id, petId: plan.petId, startDate: d.startDate, endDate: d.endDate, scheduleTimes: d.scheduleTimes })), new Date(), 7);
      for (const task of generated) await tx.taskInstance.upsert({ where: { taskDefinitionId_scheduledAt_petId: task }, update: {}, create: task });
      await tx.timelineEvent.create({ data: { petId: plan.petId, eventType: 'PLAN_ACTIVATED', occurredAt: new Date(), sourceType: 'CARE_PLAN', sourceId: plan.id, summary: `照护计划“${plan.title}”已确认` } });
      await audit(tx, actor, 'CARE_PLAN_CONFIRMED', 'care_plan', id, 'SUCCESS', { generatedTasks: generated.length });
      return { ...(await tx.carePlan.findUnique({ where: { id } })), generatedTasks: generated.length };
    });
  }
}
