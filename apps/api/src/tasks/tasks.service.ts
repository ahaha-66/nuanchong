import { ConflictException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import type { RequestActor } from '@nuanchong/contracts';
import Redis from 'ioredis';
import { audit } from '../common/audit.service';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class TasksService implements OnModuleDestroy {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true, maxRetriesPerRequest: 1 });
  constructor(private readonly prisma: PrismaService) {}
  async onModuleDestroy() { if (this.redis.status !== 'end') await this.redis.quit().catch(() => undefined); }
  list(actor: RequestActor, petId: string, from?: string, to?: string) {
    return this.prisma.withActor(actor, tx => tx.taskInstance.findMany({ where: { petId, scheduledAt: { gte: from ? new Date(from) : new Date(Date.now() - 86400000), lte: to ? new Date(to) : new Date(Date.now() + 7 * 86400000) } }, include: { definition: true, executions: { orderBy: { createdAt: 'desc' } } }, orderBy: { scheduledAt: 'asc' } }));
  }
  async claim(actor: RequestActor, id: string, expectedVersion: number) {
    if (this.redis.status === 'wait') await this.redis.connect();
    const claimKey = `task-claim:${id}`;
    const claimed = await this.redis.set(claimKey, actor.userId, 'EX', 300, 'NX');
    if (!claimed) throw new ConflictException({ code: 'CONFLICT', message: 'Task is already being handled' });
    try {
      return await this.prisma.withActor(actor, async tx => {
        const updated = await tx.taskInstance.updateMany({ where: { id, status: 'PENDING', version: expectedVersion }, data: { status: 'CLAIMED', claimedById: actor.userId, claimedAt: new Date(), version: { increment: 1 } } });
        if (!updated.count) {
          const current = await tx.taskInstance.findUnique({ where: { id } });
          throw new ConflictException({ code: 'VERSION_CONFLICT', current });
        }
        await audit(tx, actor, 'TASK_CLAIMED', 'task_instance', id);
        return tx.taskInstance.findUnique({ where: { id } });
      });
    } catch (error) {
      await this.redis.del(claimKey);
      throw error;
    }
  }
  complete(actor: RequestActor, id: string, data: { version: number; outcome: 'COMPLETED' | 'SKIPPED' | 'ABNORMAL'; note?: string }) {
    return this.prisma.withActor(actor, async tx => {
      const task = await tx.taskInstance.findUnique({ where: { id }, include: { definition: true } });
      if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
      const updated = await tx.taskInstance.updateMany({ where: { id, status: { in: ['PENDING', 'CLAIMED'] }, version: data.version }, data: { status: data.outcome, claimedById: actor.userId, claimedAt: task.claimedAt ?? new Date(), version: { increment: 1 } } });
      if (!updated.count) {
        const current = await tx.taskInstance.findUnique({ where: { id }, include: { executions: { orderBy: { createdAt: 'desc' }, take: 1 } } });
        throw new ConflictException({ code: 'VERSION_CONFLICT', current });
      }
      const execution = await tx.taskExecution.create({ data: { taskInstanceId: id, actorUserId: actor.userId, outcome: data.outcome, note: data.note } });
      await tx.timelineEvent.create({ data: { petId: task.petId, eventType: 'TASK_EXECUTED', occurredAt: new Date(), sourceType: 'TASK_EXECUTION', sourceId: execution.id, summary: `${task.definition.title}：${data.outcome}` } });
      await audit(tx, actor, 'TASK_COMPLETED', 'task_instance', id, 'SUCCESS', { outcome: data.outcome });
      return { task: await tx.taskInstance.findUnique({ where: { id } }), execution };
    });
  }
  correct(actor: RequestActor, id: string, data: { outcome: 'COMPLETED' | 'SKIPPED' | 'ABNORMAL'; note: string }) {
    return this.prisma.withActor(actor, async tx => {
      const task = await tx.taskInstance.findUnique({ where: { id }, include: { executions: { orderBy: { createdAt: 'desc' }, take: 1 }, definition: true } });
      if (!task?.executions[0]) throw new NotFoundException({ code: 'NOT_FOUND' });
      const correction = await tx.taskExecution.create({ data: { taskInstanceId: id, actorUserId: actor.userId, outcome: data.outcome, note: data.note, correctsExecutionId: task.executions[0].id } });
      await tx.taskInstance.update({ where: { id }, data: { status: data.outcome, version: { increment: 1 } } });
      await tx.timelineEvent.create({ data: { petId: task.petId, eventType: 'TASK_CORRECTED', occurredAt: new Date(), sourceType: 'TASK_EXECUTION', sourceId: correction.id, summary: `${task.definition.title}：已更正为 ${data.outcome}`, metadata: { correctsExecutionId: task.executions[0].id } } });
      await audit(tx, actor, 'TASK_CORRECTED', 'task_instance', id);
      return correction;
    });
  }
}

