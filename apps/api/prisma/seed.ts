import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('WarmPet2026!', { type: argon2.argon2id });
  const [userA, userB, vet, readOnly, hospitalBUser] = await Promise.all([
    prisma.user.upsert({ where: { email: 'owner.a@example.com' }, update: {}, create: { email: 'owner.a@example.com', displayName: '宠主A' } }),
    prisma.user.upsert({ where: { email: 'owner.b@example.com' }, update: {}, create: { email: 'owner.b@example.com', displayName: '宠主B' } }),
    prisma.user.upsert({ where: { email: 'vet@hospital-a.example.com' }, update: { passwordHash }, create: { email: 'vet@hospital-a.example.com', displayName: '医院甲兽医', passwordHash } }),
    prisma.user.upsert({ where: { email: 'readonly@hospital-a.example.com' }, update: { passwordHash }, create: { email: 'readonly@hospital-a.example.com', displayName: '医院甲只读', passwordHash } }),
    prisma.user.upsert({ where: { email: 'vet@hospital-b.example.com' }, update: { passwordHash }, create: { email: 'vet@hospital-b.example.com', displayName: '医院乙兽医', passwordHash } }),
  ]);
  const hospitalA = await prisma.organization.create({ data: { name: '暖心动物医院甲' } });
  const hospitalB = await prisma.organization.create({ data: { name: '安心动物医院乙' } });
  await prisma.organizationMember.createMany({ data: [
    { organizationId: hospitalA.id, userId: vet.id, role: 'VET' },
    { organizationId: hospitalA.id, userId: readOnly.id, role: 'READ_ONLY' },
    { organizationId: hospitalB.id, userId: hospitalBUser.id, role: 'VET' },
  ], skipDuplicates: true });
  const petA = await prisma.pet.create({ data: { name: '豆包', species: 'DOG', birthDate: new Date('2012-05-01') } });
  const petB = await prisma.pet.create({ data: { name: '年糕', species: 'CAT', birthDate: new Date('2013-08-12') } });
  await prisma.petMember.createMany({ data: [
    { petId: petA.id, userId: userA.id, role: 'OWNER' },
    { petId: petB.id, userId: userA.id, role: 'OWNER' },
    { petId: petB.id, userId: userB.id, role: 'FAMILY' },
  ] });
  await prisma.consentGrant.create({ data: { petId: petB.id, organizationId: hospitalA.id, grantedById: userA.id, scopes: ['CARE_PLAN', 'TASK_EXECUTIONS', 'OBSERVATIONS', 'TIMELINE'], startsAt: new Date(Date.now() - 3600000), endsAt: new Date(Date.now() + 30 * 86400000) } });
  console.log(JSON.stringify({ userA: userA.id, userB: userB.id, petA: petA.id, petB: petB.id, hospitalA: hospitalA.id, hospitalB: hospitalB.id }, null, 2));
}
main().finally(() => prisma.$disconnect());

