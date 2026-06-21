import { Controller, Get, Param, Query } from '@nestjs/common';
import type { RequestActor } from '@nuanchong/contracts';
import { Actor } from '../common/actor';
import { PrismaService } from '../common/prisma.service';
@Controller('pets/:petId/timeline')
export class TimelineController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() list(@Actor() actor: RequestActor, @Param('petId') petId: string, @Query('cursor') cursor?: string) {
    return this.prisma.withActor(actor, tx => tx.timelineEvent.findMany({ where: { petId }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 50, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) }));
  }
}

