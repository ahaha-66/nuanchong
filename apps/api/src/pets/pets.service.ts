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
