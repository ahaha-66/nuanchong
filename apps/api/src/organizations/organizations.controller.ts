import { Controller, Get, Param } from '@nestjs/common';
import type { RequestActor } from '@nuanchong/contracts';
import { Actor } from '../common/actor';
import { PrismaService } from '../common/prisma.service';
@Controller('organizations/:organizationId')
export class OrganizationsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('patients') patients(@Actor() actor: RequestActor, @Param('organizationId') organizationId: string) {
    const scopedActor = { ...actor, organizationId };
    return this.prisma.withActor(scopedActor, tx => tx.pet.findMany({ where: { consents: { some: { organizationId, revokedAt: null, startsAt: { lte: new Date() }, endsAt: { gt: new Date() } } } }, include: { consents: { where: { organizationId, revokedAt: null } } } }));
  }
}

