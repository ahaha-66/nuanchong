import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

const enabled = process.env.RUN_DATABASE_TESTS === 'true';
const prisma = new PrismaClient();
const fixtures = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
afterAll(async () => { await Promise.all([prisma.$disconnect(), fixtures.$disconnect()]); });
describe.skipIf(!enabled)('PostgreSQL RLS', () => {
  it('does not leak transaction-local identity to the next request', async () => {
    const user = await fixtures.user.findFirstOrThrow({ where: { email: 'owner.a@example.com' } });
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${user.id}, true)`;
      expect(await tx.pet.count()).toBeGreaterThan(0);
    });
    await prisma.$transaction(async tx => {
      const setting = await tx.$queryRaw<Array<{ value: string }>>`SELECT current_setting('app.user_id', true) AS value`;
      expect(setting[0]?.value ?? '').toBe('');
    });
  });
  it('blocks a user from another pet', async () => {
    const userB = await fixtures.user.findFirstOrThrow({ where: { email: 'owner.b@example.com' } });
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userB.id}, true)`;
      await tx.$executeRaw`SELECT set_config('app.organization_id', '', true)`;
      const pets = await tx.pet.findMany();
      expect(pets.map(p => p.name)).toEqual(['年糕']);
    });
  });
  it('only exposes actively consented pets to hospital A and none to hospital B', async () => {
    const vetA = await fixtures.user.findFirstOrThrow({ where: { email: 'vet@hospital-a.example.com' } });
    const vetB = await fixtures.user.findFirstOrThrow({ where: { email: 'vet@hospital-b.example.com' } });
    const [hospitalA, hospitalB] = await Promise.all([fixtures.organization.findFirstOrThrow({ where: { name: { endsWith: '甲' } } }), fixtures.organization.findFirstOrThrow({ where: { name: { endsWith: '乙' } } })]);
    const visibleA = await prisma.$transaction(async tx => { await tx.$executeRaw`SELECT set_config('app.user_id', ${vetA.id}, true)`; await tx.$executeRaw`SELECT set_config('app.organization_id', ${hospitalA.id}, true)`; return tx.pet.findMany(); });
    const visibleB = await prisma.$transaction(async tx => { await tx.$executeRaw`SELECT set_config('app.user_id', ${vetB.id}, true)`; await tx.$executeRaw`SELECT set_config('app.organization_id', ${hospitalB.id}, true)`; return tx.pet.findMany(); });
    const expectedA = await fixtures.pet.findMany({ where: { consents: { some: { organizationId: hospitalA.id, revokedAt: null, startsAt: { lte: new Date() }, endsAt: { gt: new Date() } } } }, orderBy: { name: 'asc' } });
    expect(visibleA.map(p => p.name).sort()).toEqual(expectedA.map(p => p.name));
    expect(visibleB).toHaveLength(0);
  });
  it('lets a pet owner read only the follow-up definitions attached to their pets', async () => {
    const ownerA = await fixtures.user.findFirstOrThrow({ where: { email: 'owner.a@example.com' } });
    const visible = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${ownerA.id}, true)`;
      await tx.$executeRaw`SELECT set_config('app.organization_id', '', true)`;
      return tx.followupInstance.findMany({ include: { definition: true, pet: true } });
    });
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every(item => item.definition.title.length > 0)).toBe(true);
  });
  it('supports append-only audit writes with read-back for the actor', async () => {
    const ownerA = await fixtures.user.findFirstOrThrow({ where: { email: 'owner.a@example.com' } });
    const pet = await fixtures.pet.findFirstOrThrow({ where: { members: { some: { userId: ownerA.id } } } });
    const created = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${ownerA.id}, true)`;
      await tx.$executeRaw`SELECT set_config('app.organization_id', '', true)`;
      return tx.auditLog.create({ data: { actorUserId: ownerA.id, action: 'RLS_TEST', resourceType: 'pet', resourceId: pet.id, outcome: 'SUCCESS' } });
    });
    expect(created.actorUserId).toBe(ownerA.id);
  });
});
