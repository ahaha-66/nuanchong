import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PetRole } from '@prisma/client';
import type { RequestActor } from '@nuanchong/contracts';
import { createHash, randomBytes } from 'node:crypto';
import { audit } from '../common/audit.service';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PetsService {
  constructor(private readonly prisma: PrismaService) {}
  list(actor: RequestActor) {
    return this.prisma.withActor(actor, tx => tx.pet.findMany({ include: { members: { where: { userId: actor.userId } } }, orderBy: { createdAt: 'desc' } }));
  }
  create(actor: RequestActor, data: { name: string; species: 'CAT' | 'DOG' | 'OTHER'; sex?: 'MALE' | 'FEMALE' | 'UNKNOWN'; birthDate?: string }) {
    return this.prisma.withActor(actor, async tx => {
      const pet = await tx.pet.create({ data: { name: data.name, species: data.species, sex: data.sex ?? 'UNKNOWN', birthDate: data.birthDate ? new Date(data.birthDate) : undefined } });
      await tx.petMember.create({ data: { petId: pet.id, userId: actor.userId, role: 'OWNER' } });
      await audit(tx, actor, 'PET_CREATED', 'pet', pet.id);
      return pet;
    });
  }
  careCard(actor: RequestActor, petId: string) {
    return this.prisma.withActor(actor, async tx => {
      const now = new Date();
      const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999);
      const pet = await tx.pet.findUnique({ where: { id: petId } });
      if (!pet) throw new NotFoundException({ code: 'NOT_FOUND' });
      const [plans, tasks, observations, recentEvents, followups] = await Promise.all([
        tx.carePlan.findMany({ where: { petId, status: { in: ['ACTIVE', 'PENDING_CONFIRMATION'] } }, include: { taskDefinitions: true }, orderBy: { updatedAt: 'desc' } }),
        tx.taskInstance.findMany({ where: { petId, scheduledAt: { gte: dayStart, lte: dayEnd } }, include: { definition: true, executions: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { scheduledAt: 'asc' } }),
        tx.observationRecord.findMany({ where: { petId, occurredAt: { gte: new Date(now.getTime() - 7 * 86400000) } }, orderBy: { occurredAt: 'desc' }, take: 20 }),
        tx.timelineEvent.findMany({ where: { petId }, orderBy: { occurredAt: 'desc' }, take: 5 }),
        tx.followupInstance.findMany({ where: { petId, status: { in: ['SENT', 'SUBMITTED', 'CLAIMED'] }, expiresAt: { gt: now } }, include: { definition: true }, orderBy: { scheduledAt: 'asc' } }),
      ]);
      const completed = tasks.filter(task => task.status === 'COMPLETED').length;
      return {
        pet,
        stage: plans.some(plan => /术后|伤口/.test(plan.title)) ? '术后恢复' : plans.length ? '持续照护' : '基础观察',
        activePlans: plans.filter(plan => plan.status === 'ACTIVE'),
        pendingPlans: plans.filter(plan => plan.status === 'PENDING_CONFIRMATION'),
        tasks,
        progress: { completed, total: tasks.length, rate: tasks.length ? Math.round(completed / tasks.length * 100) : 0 },
        focusItems: Array.from(new Set(plans.flatMap(plan => plan.taskDefinitions.filter(item => ['OBSERVATION', 'MEASUREMENT'].includes(item.kind)).map(item => item.title)))).slice(0, 3),
        recentObservations: observations,
        recentEvents,
        followups,
        disclaimer: '暖宠协助记录与协作，不替代兽医诊断。医院连接不代表实时监控。',
      };
    });
  }
  createObservation(actor: RequestActor, petId: string, data: { category: string; occurredAt?: string; summary: string; value?: string; unit?: string }) {
    return this.prisma.withActor(actor, async tx => {
      const member = await tx.petMember.findFirst({ where: { petId, userId: actor.userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
      if (!member) throw new ForbiddenException({ code: 'FORBIDDEN' });
      const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();
      const observation = await tx.observationRecord.create({ data: { petId, actorUserId: actor.userId, category: data.category, occurredAt, summary: data.summary, value: data.value, unit: data.unit } });
      await tx.timelineEvent.create({ data: { petId, eventType: 'OBSERVATION', occurredAt, sourceType: 'OBSERVATION', sourceId: observation.id, summary: data.summary, metadata: { category: data.category, value: data.value ?? null, unit: data.unit ?? null } } });
      await audit(tx, actor, 'OBSERVATION_CREATED', 'observation_record', observation.id, 'SUCCESS', { category: data.category });
      return observation;
    });
  }
  async invite(actor: RequestActor, petId: string, data: { email: string; role: PetRole; expiresAt?: string }) {
    return this.prisma.withActor(actor, async tx => {
      const owner = await tx.petMember.findFirst({ where: { petId, userId: actor.userId, role: 'OWNER' } });
      if (!owner) throw new ForbiddenException({ code: 'FORBIDDEN' });
      const rawToken = randomBytes(32).toString('base64url');
      const invitation = await tx.memberInvitation.create({ data: { petId, email: data.email, role: data.role, tokenHash: createHash('sha256').update(rawToken).digest('hex'), expiresAt: data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 7 * 86400000) } });
      await audit(tx, actor, 'MEMBER_INVITED', 'member_invitation', invitation.id, 'SUCCESS', { role: data.role });
      return { ...invitation, invitationToken: rawToken };
    });
  }
  async updateMember(actor: RequestActor, petId: string, memberId: string, data: { role?: PetRole; expiresAt?: string | null; remove?: boolean }) {
    return this.prisma.withActor(actor, async tx => {
      const owner = await tx.petMember.findFirst({ where: { petId, userId: actor.userId, role: 'OWNER' } });
      if (!owner) throw new ForbiddenException({ code: 'FORBIDDEN' });
      const member = await tx.petMember.findFirst({ where: { id: memberId, petId } });
      if (!member) throw new NotFoundException({ code: 'NOT_FOUND' });
      if ((data.remove || data.role !== 'OWNER') && member.role === 'OWNER') {
        const owners = await tx.petMember.count({ where: { petId, role: 'OWNER' } });
        if (owners <= 1) throw new ConflictException('Transfer ownership before removing the only owner');
      }
      if (data.role === 'TEMP_CARER' && !data.expiresAt) throw new ConflictException('Temporary carers require an expiry');
      if (data.remove) { await tx.petMember.delete({ where: { id: member.id } }); return { removed: true }; }
      return tx.petMember.update({ where: { id: member.id }, data: { role: data.role, expiresAt: data.expiresAt === null ? null : data.expiresAt ? new Date(data.expiresAt) : undefined } });
    });
  }
}
