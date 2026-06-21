import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ExtractionResultSchema, type ExtractionResult, type RequestActor } from '@nuanchong/contracts';
import type { Prisma } from '@prisma/client';
import { audit } from '../common/audit.service';
import { PrismaService } from '../common/prisma.service';
import type { AiProvider } from './ai.provider';
import { enforceMedicalBoundary } from './medical-safety';
export const AI_PROVIDER = Symbol('AI_PROVIDER');

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService, @Inject(AI_PROVIDER) private readonly provider: AiProvider) {}
  async create(actor: RequestActor, input: { petId: string; text: string; mediaAssetId?: string }) {
    const extraction = await this.prisma.withActor(actor, tx => tx.aiExtraction.create({ data: { petId: input.petId, actorUserId: actor.userId, sourceText: input.text, mediaAssetId: input.mediaAssetId, status: 'PROCESSING', model: this.provider.model } }));
    try {
      const pendingTasks = await this.prisma.withActor(actor, tx => tx.taskInstance.findMany({ where: { petId: input.petId, status: { in: ['PENDING', 'CLAIMED'] } }, include: { definition: true }, take: 20 }));
      const result = enforceMedicalBoundary(await this.provider.extractObservation({ text: input.text, pendingTasks: pendingTasks.map(t => ({ id: t.id, title: t.definition.title })) }));
      return this.prisma.withActor(actor, tx => tx.aiExtraction.update({ where: { id: extraction.id }, data: { status: 'NEEDS_CONFIRMATION', result: result as unknown as Prisma.InputJsonValue } }));
    } catch (error) {
      await this.prisma.withActor(actor, tx => tx.aiExtraction.update({ where: { id: extraction.id }, data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message : 'Unknown AI error' } }));
      throw error;
    }
  }
  get(actor: RequestActor, id: string) { return this.prisma.withActor(actor, tx => tx.aiExtraction.findUnique({ where: { id } })); }
  confirm(actor: RequestActor, id: string, result: ExtractionResult) {
    const safeResult = enforceMedicalBoundary(ExtractionResultSchema.parse(result));
    return this.prisma.withActor(actor, async tx => {
      const extraction = await tx.aiExtraction.findFirst({ where: { id, actorUserId: actor.userId, status: 'NEEDS_CONFIRMATION' } });
      if (!extraction) throw new NotFoundException({ code: 'NOT_FOUND' });
      const occurredAt = new Date(String(safeResult.occurredAt.value));
      const observation = await tx.observationRecord.create({ data: { petId: extraction.petId, actorUserId: actor.userId, category: safeResult.category, occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt, summary: String(safeResult.summary.value), value: safeResult.value ? String(safeResult.value.value ?? '') : undefined, unit: safeResult.unit ? String(safeResult.unit.value ?? '') : undefined, sourceExtractionId: extraction.id } });
      await tx.aiExtraction.update({ where: { id }, data: { status: 'CONFIRMED', result: safeResult as unknown as Prisma.InputJsonValue } });
      await tx.timelineEvent.create({ data: { petId: extraction.petId, eventType: 'OBSERVATION_CONFIRMED', occurredAt: observation.occurredAt, sourceType: 'OBSERVATION', sourceId: observation.id, summary: observation.summary } });
      await audit(tx, actor, 'AI_EXTRACTION_CONFIRMED', 'ai_extraction', id);
      return observation;
    });
  }
}

