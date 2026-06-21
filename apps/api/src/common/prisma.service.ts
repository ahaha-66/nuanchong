import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import type { RequestActor } from '@nuanchong/contracts';

export type ActorTransaction = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }

  async withActor<T>(actor: RequestActor, work: (tx: ActorTransaction) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${actor.userId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.organization_id', ${actor.organizationId ?? ''}, true)`;
      await tx.$executeRaw`SELECT set_config('app.support_access_id', ${actor.supportAccessId ?? ''}, true)`;
      return work(tx);
    });
  }
}

