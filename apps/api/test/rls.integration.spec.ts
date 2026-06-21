import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

const enabled = process.env.RUN_DATABASE_TESTS === 'true';
const prisma = new PrismaClient();
describe.skipIf(!enabled)('PostgreSQL RLS', () => {
  it('does not leak transaction-local identity to the next request', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { email: 'owner.a@example.com' } });
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
    const userB = await prisma.user.findFirstOrThrow({ where: { email: 'owner.b@example.com' } });
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userB.id}, true)`;
      await tx.$executeRaw`SELECT set_config('app.organization_id', '', true)`;
      const pets = await tx.pet.findMany();
      expect(pets.map(p => p.name)).toEqual(['年糕']);
    });
  });
  it('only exposes the consented pet to hospital A and none to hospital B', async () => {
    const vetA = await prisma.user.findFirstOrThrow({ where: { email: 'vet@hospital-a.example.com' } });
    const vetB = await prisma.user.findFirstOrThrow({ where: { email: 'vet@hospital-b.example.com' } });
    const [hospitalA, hospitalB] = await Promise.all([prisma.organization.findFirstOrThrow({ where: { name: { endsWith: '甲' } } }), prisma.organization.findFirstOrThrow({ where: { name: { endsWith: '乙' } } })]);
    const visibleA = await prisma.$transaction(async tx => { await tx.$executeRaw`SELECT set_config('app.user_id', ${vetA.id}, true)`; await tx.$executeRaw`SELECT set_config('app.organization_id', ${hospitalA.id}, true)`; return tx.pet.findMany(); });
    const visibleB = await prisma.$transaction(async tx => { await tx.$executeRaw`SELECT set_config('app.user_id', ${vetB.id}, true)`; await tx.$executeRaw`SELECT set_config('app.organization_id', ${hospitalB.id}, true)`; return tx.pet.findMany(); });
    expect(visibleA.map(p => p.name)).toEqual(['年糕']);
    expect(visibleB).toHaveLength(0);
  });
});

