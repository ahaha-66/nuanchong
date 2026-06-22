import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const seedDatabaseUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!seedDatabaseUrl) throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required');
const prisma = new PrismaClient({ datasourceUrl: seedDatabaseUrl });

function at(dayOffset: number, hour: number) {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date;
}

async function seedCareScenario(input: {
  petId: string;
  organizationId: string;
  ownerId: string;
  creatorId: string;
  title: string;
  tasks: Array<{ title: string; kind: 'MEDICATION' | 'FEEDING' | 'MEASUREMENT' | 'OBSERVATION'; time: string; instructions: string }>;
  observations: Array<{ category: string; summary: string; value?: string; unit?: string; dayOffset: number }>;
}) {
  let plan = await prisma.carePlan.findFirst({ where: { petId: input.petId, organizationId: input.organizationId, title: input.title } });
  if (!plan) {
    plan = await prisma.carePlan.create({ data: { petId: input.petId, organizationId: input.organizationId, title: input.title, status: 'ACTIVE', version: 3, createdById: input.creatorId, confirmedById: input.ownerId, confirmedAt: at(-6, 2) } });
    const version = await prisma.planVersion.create({ data: { carePlanId: plan.id, number: 1, snapshot: { title: input.title, source: 'HOSPITAL', tasks: input.tasks }, requiresConfirmation: true } });
    await prisma.carePlan.update({ where: { id: plan.id }, data: { currentPlanVersionId: version.id } });
    for (const task of input.tasks) {
      const definition = await prisma.taskDefinition.create({ data: { carePlanId: plan.id, planVersionId: version.id, title: task.title, kind: task.kind, scheduleTimes: [task.time], startDate: at(-6, 0), endDate: at(21, 0), instructions: task.instructions } });
      const hour = Number(task.time.slice(0, 2));
      for (const dayOffset of [-2, -1, 0, 1]) {
        const scheduledAt = at(dayOffset, hour);
        const isPast = scheduledAt < new Date();
        const abnormal = input.petId.endsWith('0') && dayOffset === -1;
        const status = abnormal ? 'ABNORMAL' : isPast && dayOffset < 0 ? 'COMPLETED' : 'PENDING';
        const instance = await prisma.taskInstance.upsert({ where: { taskDefinitionId_scheduledAt_petId: { taskDefinitionId: definition.id, scheduledAt, petId: input.petId } }, update: {}, create: { taskDefinitionId: definition.id, scheduledAt, petId: input.petId, status } });
        if (status !== 'PENDING' && !(await prisma.taskExecution.findFirst({ where: { taskInstanceId: instance.id } }))) {
          const execution = await prisma.taskExecution.create({ data: { taskInstanceId: instance.id, actorUserId: input.ownerId, outcome: status, note: abnormal ? '宠物抗拒，本次未完整执行' : '按计划完成' } });
          await prisma.timelineEvent.create({ data: { petId: input.petId, eventType: 'TASK_EXECUTED', occurredAt: new Date(scheduledAt.getTime() + 20 * 60000), sourceType: 'TASK_EXECUTION', sourceId: execution.id, summary: `${task.title}：${status === 'COMPLETED' ? '已完成' : '执行异常'}` } });
        }
      }
    }
    await prisma.timelineEvent.create({ data: { petId: input.petId, eventType: 'PLAN_ACTIVATED', occurredAt: at(-6, 2), sourceType: 'CARE_PLAN', sourceId: plan.id, summary: `照护计划“${input.title}”已确认` } });
  }
  const recentObservation = await prisma.observationRecord.findFirst({ where: { petId: input.petId, occurredAt: { gte: at(-7, 0) } } });
  if (!recentObservation) {
    for (const item of input.observations) {
      const occurredAt = at(item.dayOffset, 12);
      const observation = await prisma.observationRecord.create({ data: { petId: input.petId, actorUserId: input.ownerId, category: item.category, occurredAt, summary: item.summary, value: item.value, unit: item.unit } });
      await prisma.timelineEvent.create({ data: { petId: input.petId, eventType: 'OBSERVATION', occurredAt, sourceType: 'OBSERVATION', sourceId: observation.id, summary: item.summary, metadata: { category: item.category } } });
    }
  }
}

async function seedTemplate(input: { organizationId: string; creatorId: string; reviewerId: string; name: string; category: string; diseaseTag: string; description: string; tasks: Array<{ title: string; kind: 'MEDICATION' | 'FEEDING' | 'MEASUREMENT' | 'OBSERVATION' | 'OTHER'; defaultTime: string; instructions: string }>; focus: string[] }) {
  const existing = await prisma.careTemplate.findFirst({ where: { organizationId: input.organizationId, name: input.name } });
  if (existing) return existing;
  return prisma.careTemplate.create({ data: {
    organizationId: input.organizationId, name: input.name, category: input.category, diseaseTag: input.diseaseTag, description: input.description,
    versions: { create: { number: 1, createdById: input.creatorId, reviewerId: input.reviewerId, reviewStatus: 'PUBLISHED', reviewNote: '首批 MVP 兽医审核模板', reviewedAt: new Date(), publishedAt: new Date(), content: { applicableConditions: [input.description], contraindications: ['具体任务、药物和剂量必须由接诊兽医按个体情况确认'], observationFocus: input.focus, tasks: input.tasks, disclaimer: '本模板用于照护计划编排，不构成诊断或处方；医院下发前必须人工确认。' } } },
  } });
}

async function main() {
  const passwordHash = await argon2.hash('WarmPet2026!', { type: argon2.argon2id });
  const [userA, userB, vet, readOnly, hospitalBUser, admin] = await Promise.all([
    prisma.user.upsert({ where: { email: 'owner.a@example.com' }, update: {}, create: { email: 'owner.a@example.com', displayName: '宠主A' } }),
    prisma.user.upsert({ where: { email: 'owner.b@example.com' }, update: {}, create: { email: 'owner.b@example.com', displayName: '宠主B' } }),
    prisma.user.upsert({ where: { email: 'vet@hospital-a.example.com' }, update: { passwordHash }, create: { email: 'vet@hospital-a.example.com', displayName: '医院甲兽医', passwordHash } }),
    prisma.user.upsert({ where: { email: 'readonly@hospital-a.example.com' }, update: { passwordHash }, create: { email: 'readonly@hospital-a.example.com', displayName: '医院甲只读', passwordHash } }),
    prisma.user.upsert({ where: { email: 'vet@hospital-b.example.com' }, update: { passwordHash }, create: { email: 'vet@hospital-b.example.com', displayName: '医院乙兽医', passwordHash } }),
    prisma.user.upsert({ where: { email: 'admin@hospital-a.example.com' }, update: { passwordHash }, create: { email: 'admin@hospital-a.example.com', displayName: '医院甲管理员', passwordHash } }),
  ]);
  const hospitalA = await prisma.organization.findFirst({ where: { name: '暖心动物医院甲' } })
    ?? await prisma.organization.create({ data: { name: '暖心动物医院甲' } });
  const hospitalB = await prisma.organization.findFirst({ where: { name: '安心动物医院乙' } })
    ?? await prisma.organization.create({ data: { name: '安心动物医院乙' } });
  await prisma.organizationMember.createMany({ data: [
    { organizationId: hospitalA.id, userId: vet.id, role: 'VET' },
    { organizationId: hospitalA.id, userId: readOnly.id, role: 'READ_ONLY' },
    { organizationId: hospitalB.id, userId: hospitalBUser.id, role: 'VET' },
    { organizationId: hospitalA.id, userId: admin.id, role: 'ADMIN' },
  ], skipDuplicates: true });
  const petA = await prisma.pet.findFirst({ where: { name: '豆包', members: { some: { userId: userA.id } } } })
    ?? await prisma.pet.create({ data: { name: '豆包', species: 'DOG', birthDate: new Date('2012-05-01') } });
  const petB = await prisma.pet.findFirst({ where: { name: '年糕', members: { some: { userId: userA.id } } } })
    ?? await prisma.pet.create({ data: { name: '年糕', species: 'CAT', birthDate: new Date('2013-08-12') } });
  await prisma.petMember.createMany({ data: [
    { petId: petA.id, userId: userA.id, role: 'OWNER' },
    { petId: petB.id, userId: userA.id, role: 'OWNER' },
    { petId: petB.id, userId: userB.id, role: 'FAMILY' },
  ], skipDuplicates: true });
  for (const pet of [petA, petB]) {
    const consent = await prisma.consentGrant.findFirst({ where: { petId: pet.id, organizationId: hospitalA.id, revokedAt: null, endsAt: { gt: new Date() } } });
    if (!consent) await prisma.consentGrant.create({ data: { petId: pet.id, organizationId: hospitalA.id, grantedById: userA.id, scopes: ['CARE_PLAN', 'TASK_EXECUTIONS', 'OBSERVATIONS', 'TIMELINE'], startsAt: new Date(Date.now() - 3600000), endsAt: new Date(Date.now() + 30 * 86400000) } });
  }
  await seedCareScenario({ petId: petA.id, organizationId: hospitalA.id, ownerId: userA.id, creatorId: vet.id, title: '老年犬心脏长期照护', tasks: [
    { title: '早间用药', kind: 'MEDICATION', time: '08:00', instructions: '按医院确认剂量给药，记录是否完整服用' },
    { title: '静息呼吸频率', kind: 'MEASUREMENT', time: '21:00', instructions: '安静或睡眠状态下计数一分钟' },
  ], observations: [
    { category: 'RESPIRATION', summary: '静息呼吸每分钟 24 次，状态平稳', value: '24', unit: '次/分', dayOffset: -2 },
    { category: 'APPETITE', summary: '今日食欲正常，完成约九成', value: '90', unit: '%', dayOffset: -1 },
    { category: 'ACTIVITY', summary: '晚间散步 15 分钟，无明显咳嗽', value: '15', unit: '分钟', dayOffset: 0 },
  ] });
  await seedCareScenario({ petId: petB.id, organizationId: hospitalA.id, ownerId: userA.id, creatorId: vet.id, title: '慢性肾病居家观察', tasks: [
    { title: '处方粮进食记录', kind: 'FEEDING', time: '09:00', instructions: '记录实际进食比例' },
    { title: '饮水与排尿观察', kind: 'OBSERVATION', time: '20:00', instructions: '记录相对平日是否有明显变化' },
  ], observations: [
    { category: 'WATER', summary: '饮水较平日略多，已记录供复诊参考', value: '略多', dayOffset: -3 },
    { category: 'APPETITE', summary: '处方粮完成约七成', value: '70', unit: '%', dayOffset: -1 },
    { category: 'URINE', summary: '排尿次数 4 次，未见明显异常', value: '4', unit: '次', dayOffset: 0 },
  ] });
  const commonMedication = (title: string) => ({ title, kind: 'MEDICATION' as const, defaultTime: '08:00', instructions: '药名、剂量、单位和给药方式由下发兽医逐项确认' });
  for (const template of [
    { name: '心脏病长期用药照护', category: 'CHRONIC', diseaseTag: 'CARDIAC', description: '适用于已完成诊断并由兽医制定长期用药方案的犬猫', focus: ['静息呼吸频率', '咳嗽', '活动耐力'], tasks: [commonMedication('早间用药'), { title: '静息呼吸频率', kind: 'MEASUREMENT' as const, defaultTime: '21:00', instructions: '安静或睡眠状态下计数一分钟' }] },
    { name: '慢性肾病居家观察', category: 'CHRONIC', diseaseTag: 'RENAL', description: '适用于已确诊慢性肾病并需要饮食及状态追踪的宠物', focus: ['食欲', '饮水', '排尿'], tasks: [{ title: '处方粮进食记录', kind: 'FEEDING' as const, defaultTime: '09:00', instructions: '记录实际进食比例' }, { title: '饮水与排尿观察', kind: 'OBSERVATION' as const, defaultTime: '20:00', instructions: '与宠物自身平日基线比较' }] },
    { name: '糖尿病家庭照护', category: 'CHRONIC', diseaseTag: 'DIABETES', description: '适用于已有兽医明确治疗方案的糖尿病犬猫', focus: ['进食', '饮水排尿', '精神状态'], tasks: [commonMedication('按医嘱用药'), { title: '进食与状态记录', kind: 'OBSERVATION' as const, defaultTime: '19:00', instructions: '记录进食比例及精神状态' }] },
    { name: '关节疾病活动管理', category: 'CHRONIC', diseaseTag: 'JOINT', description: '适用于关节疾病或行动能力下降宠物的家庭观察', focus: ['起身', '步态', '喜欢的活动'], tasks: [{ title: '活动能力观察', kind: 'OBSERVATION' as const, defaultTime: '19:00', instructions: '记录起身、楼梯和散步表现' }] },
    { name: '常见术后两周照护', category: 'POST_OP', diseaseTag: 'POST_OP', description: '适用于医院确认可居家恢复的常见术后阶段', focus: ['伤口', '食欲', '精神状态'], tasks: [commonMedication('术后用药'), { title: '伤口观察', kind: 'OBSERVATION' as const, defaultTime: '20:00', instructions: '观察外观变化并按需拍照，不自行判断感染' }] },
    { name: '伤口护理观察', category: 'NURSING', diseaseTag: 'WOUND', description: '适用于兽医已制定护理方法的伤口居家观察', focus: ['渗出', '肿胀', '舔咬'], tasks: [{ title: '伤口护理', kind: 'OBSERVATION' as const, defaultTime: '20:00', instructions: '按医院说明护理并记录外观变化' }] },
    { name: '老年宠物基础观察', category: 'SENIOR', diseaseTag: 'SENIOR', description: '适用于老年犬猫建立食欲、活动、排泄和睡眠基线', focus: ['食欲', '活动', '睡眠'], tasks: [{ title: '每日基础状态', kind: 'OBSERVATION' as const, defaultTime: '20:00', instructions: '记录食欲、活动和排泄是否偏离自身基线' }] },
  ]) await seedTemplate({ organizationId: hospitalA.id, creatorId: vet.id, reviewerId: admin.id, ...template });
  const followupDefinition = await prisma.followupDefinition.findFirst({ where: { organizationId: hospitalA.id, title: '连续照护状态随访' } }) ?? await prisma.followupDefinition.create({ data: { organizationId: hospitalA.id, title: '连续照护状态随访', createdById: vet.id, questionSchema: [
    { key: 'overall_change', label: '与前几天相比，整体状态如何？', type: 'SINGLE_CHOICE', required: true, options: ['改善', '相近', '变差'] },
    { key: 'appetite', label: '今日食欲情况', type: 'SINGLE_CHOICE', required: true, options: ['正常', '减少', '未进食'] },
    { key: 'concern', label: '最希望兽医了解的情况', type: 'TEXT', required: false },
  ] } });
  if (!await prisma.followupInstance.findFirst({ where: { petId: petA.id, definitionId: followupDefinition.id, status: { in: ['SENT', 'SUBMITTED', 'CLAIMED'] } } })) await prisma.followupInstance.create({ data: { petId: petA.id, organizationId: hospitalA.id, definitionId: followupDefinition.id, definitionVersion: followupDefinition.version, status: 'SENT', scheduledAt: at(0, 1), sentAt: at(0, 1), expiresAt: at(3, 23) } });
  if (!await prisma.followupInstance.findFirst({ where: { petId: petB.id, definitionId: followupDefinition.id, status: { in: ['SENT', 'SUBMITTED', 'CLAIMED'] } } })) await prisma.followupInstance.create({ data: { petId: petB.id, organizationId: hospitalA.id, definitionId: followupDefinition.id, definitionVersion: followupDefinition.version, status: 'SUBMITTED', scheduledAt: at(-1, 1), sentAt: at(-1, 1), submittedAt: at(0, 0), expiresAt: at(2, 23), responsePayload: { overall_change: '相近', appetite: '减少', concern: '近两天处方粮进食量下降，希望复诊时重点沟通' } } });
  console.log(JSON.stringify({ userA: userA.id, userB: userB.id, petA: petA.id, petB: petB.id, hospitalA: hospitalA.id, hospitalB: hospitalB.id }, null, 2));
}
main().finally(() => prisma.$disconnect());
