import { Controller, Get, Param } from '@nestjs/common';
import type { RequestActor } from '@nuanchong/contracts';
import { Actor } from '../common/actor';
import { PrismaService } from '../common/prisma.service';
@Controller('organizations/:organizationId')
export class OrganizationsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('patients') patients(@Actor() actor: RequestActor, @Param('organizationId') organizationId: string) {
    const scopedActor = { ...actor, organizationId };
    return this.prisma.withActor(scopedActor, async tx => {
      const now = new Date();
      const since = new Date(now.getTime() - 7 * 86400000);
      const pets = await tx.pet.findMany({
        where: { consents: { some: { organizationId, revokedAt: null, startsAt: { lte: now }, endsAt: { gt: now } } } },
        include: {
          consents: { where: { organizationId, revokedAt: null }, orderBy: { endsAt: 'desc' }, take: 1 },
          plans: { where: { organizationId, status: { in: ['ACTIVE', 'PENDING_CONFIRMATION'] } }, include: { taskDefinitions: true }, orderBy: { updatedAt: 'desc' } },
          tasks: { where: { scheduledAt: { gte: since, lte: new Date(now.getTime() + 86400000) } }, include: { definition: true, executions: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { scheduledAt: 'desc' } },
          observations: { where: { occurredAt: { gte: since } }, orderBy: { occurredAt: 'desc' }, take: 8 },
          timeline: { orderBy: { occurredAt: 'desc' }, take: 8 },
          followups: { where: { status: { in: ['SCHEDULED', 'SENT', 'SUBMITTED', 'CLAIMED'] }, expiresAt: { gt: now } }, include: { definition: true }, orderBy: [{ status: 'desc' }, { scheduledAt: 'asc' }] },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return pets.map(pet => {
        const due = pet.tasks.filter(task => task.scheduledAt <= now && task.status !== 'CANCELLED');
        const completed = due.filter(task => task.status === 'COMPLETED').length;
        const abnormal = pet.tasks.filter(task => task.status === 'ABNORMAL').length;
        const lastUpdate = [pet.observations[0]?.occurredAt, pet.tasks.find(task => task.executions.length)?.executions[0]?.createdAt].filter(Boolean).sort((a, b) => Number(b) - Number(a))[0] ?? null;
        const pendingPlan = pet.plans.some(plan => plan.status === 'PENDING_CONFIRMATION');
        const queue = abnormal ? '执行异常' : pendingPlan ? '待确认计划' : !lastUpdate || Number(now) - Number(lastUpdate) > 3 * 86400000 ? '长期未更新' : '照护进行中';
        return { ...pet, careSummary: { due: due.length, completed, completionRate: due.length ? Math.round(completed / due.length * 100) : 0, abnormal, lastUpdate, queue } };
      });
    });
  }
}
