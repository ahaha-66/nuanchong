import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConsentScope } from '@prisma/client';
import type { RequestActor } from '@nuanchong/contracts';
import { audit } from '../common/audit.service';
import { PrismaService } from '../common/prisma.service';
@Injectable()
export class ConsentsService {
  constructor(private readonly prisma: PrismaService) {}
  create(actor: RequestActor, data: { petId: string; organizationId: string; scopes: ConsentScope[]; startsAt: string; endsAt: string }) {
    if (new Date(data.endsAt) <= new Date(data.startsAt)) throw new ConflictException('Consent end must be after start');
    return this.prisma.withActor(actor, async tx => {
      const grant = await tx.consentGrant.create({ data: { ...data, grantedById: actor.userId, startsAt: new Date(data.startsAt), endsAt: new Date(data.endsAt) } });
      await audit(tx, actor, 'CONSENT_GRANTED', 'consent_grant', grant.id, 'SUCCESS', { scopes: data.scopes, organizationId: data.organizationId });
      return grant;
    });
  }
  revoke(actor: RequestActor, id: string) {
    return this.prisma.withActor(actor, async tx => {
      const grant = await tx.consentGrant.findUnique({ where: { id } });
      if (!grant) throw new NotFoundException({ code: 'NOT_FOUND' });
      const revoked = await tx.consentGrant.update({ where: { id }, data: { revokedAt: new Date() } });
      await audit(tx, actor, 'CONSENT_REVOKED', 'consent_grant', id);
      return revoked;
    });
  }
}

