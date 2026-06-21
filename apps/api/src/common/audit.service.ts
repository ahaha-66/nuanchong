import type { Prisma } from '@prisma/client';
import type { RequestActor } from '@nuanchong/contracts';
import type { ActorTransaction } from './prisma.service';

export async function audit(tx: ActorTransaction, actor: RequestActor, action: string, resourceType: string, resourceId: string | undefined, outcome = 'SUCCESS', metadata: Prisma.InputJsonValue = {}) {
  await tx.auditLog.create({ data: { actorUserId: actor.userId, organizationId: actor.organizationId, supportAccessId: actor.supportAccessId, action, resourceType, resourceId, outcome, metadata } });
}

