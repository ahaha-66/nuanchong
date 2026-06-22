import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { OrganizationRole, Prisma } from '@prisma/client';
import type { RequestActor } from '@nuanchong/contracts';
import { audit } from '../common/audit.service';
import { PrismaService, type ActorTransaction } from '../common/prisma.service';

type TemplateContent = { applicableConditions: string[]; contraindications?: string[]; observationFocus: string[]; tasks: Array<{ title: string; kind: string; defaultTime: string; instructions: string }>; disclaimer: string };
type TemplateInput = { name: string; category: string; diseaseTag?: string; description?: string; content: TemplateContent };

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}
  private async requireRole(tx: ActorTransaction, actor: RequestActor, roles: OrganizationRole[]) {
    if (!actor.organizationId) throw new ForbiddenException('Select an organization');
    const member = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: actor.organizationId, userId: actor.userId } } });
    if (!member || !roles.includes(member.role)) throw new ForbiddenException({ code: 'FORBIDDEN' });
    return member;
  }
  list(actor: RequestActor) {
    if (!actor.organizationId) throw new ForbiddenException('Select an organization');
    return this.prisma.withActor(actor, tx => tx.careTemplate.findMany({ where: { organizationId: actor.organizationId }, include: { versions: { orderBy: { number: 'desc' } } }, orderBy: { createdAt: 'desc' } }));
  }
  create(actor: RequestActor, input: TemplateInput) {
    return this.prisma.withActor(actor, async tx => {
      await this.requireRole(tx, actor, ['ADMIN', 'VET']);
      const template = await tx.careTemplate.create({ data: { organizationId: actor.organizationId!, name: input.name, category: input.category, diseaseTag: input.diseaseTag, description: input.description } });
      const version = await tx.templateVersion.create({ data: { templateId: template.id, number: 1, content: input.content as unknown as Prisma.InputJsonValue, createdById: actor.userId } });
      await audit(tx, actor, 'TEMPLATE_CREATED', 'care_template', template.id);
      return { ...template, versions: [version] };
    });
  }
  createVersion(actor: RequestActor, templateId: string, input: { content: TemplateContent }) {
    return this.prisma.withActor(actor, async tx => {
      await this.requireRole(tx, actor, ['ADMIN', 'VET']);
      const template = await tx.careTemplate.findFirst({ where: { id: templateId, organizationId: actor.organizationId } });
      if (!template) throw new NotFoundException({ code: 'NOT_FOUND' });
      const latest = await tx.templateVersion.findFirst({ where: { templateId }, orderBy: { number: 'desc' } });
      const version = await tx.templateVersion.create({ data: { templateId, number: (latest?.number ?? 0) + 1, content: input.content as unknown as Prisma.InputJsonValue, createdById: actor.userId } });
      await audit(tx, actor, 'TEMPLATE_VERSION_CREATED', 'template_version', version.id);
      return version;
    });
  }
  submitReview(actor: RequestActor, id: string) {
    return this.prisma.withActor(actor, async tx => {
      await this.requireRole(tx, actor, ['ADMIN', 'VET']);
      const changed = await tx.templateVersion.updateMany({ where: { id, reviewStatus: 'DRAFT', template: { organizationId: actor.organizationId } }, data: { reviewStatus: 'IN_REVIEW' } });
      if (!changed.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      await audit(tx, actor, 'TEMPLATE_SUBMITTED', 'template_version', id);
      return tx.templateVersion.findUnique({ where: { id } });
    });
  }
  review(actor: RequestActor, id: string, input: { approved: boolean; note: string }) {
    return this.prisma.withActor(actor, async tx => {
      await this.requireRole(tx, actor, ['ADMIN', 'VET']);
      const version = await tx.templateVersion.findFirst({ where: { id, template: { organizationId: actor.organizationId } } });
      if (!version) throw new NotFoundException({ code: 'NOT_FOUND' });
      if (version.createdById === actor.userId) throw new ConflictException('模板创建人不能审核自己的版本');
      const changed = await tx.templateVersion.updateMany({ where: { id, reviewStatus: 'IN_REVIEW' }, data: { reviewStatus: input.approved ? 'APPROVED' : 'REJECTED', reviewerId: actor.userId, reviewNote: input.note, reviewedAt: new Date() } });
      if (!changed.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      await audit(tx, actor, input.approved ? 'TEMPLATE_APPROVED' : 'TEMPLATE_REJECTED', 'template_version', id);
      return tx.templateVersion.findUnique({ where: { id } });
    });
  }
  publish(actor: RequestActor, id: string) {
    return this.prisma.withActor(actor, async tx => {
      await this.requireRole(tx, actor, ['ADMIN']);
      const version = await tx.templateVersion.findFirst({ where: { id, template: { organizationId: actor.organizationId } } });
      if (!version) throw new NotFoundException({ code: 'NOT_FOUND' });
      const changed = await tx.templateVersion.updateMany({ where: { id, reviewStatus: 'APPROVED' }, data: { reviewStatus: 'PUBLISHED', publishedAt: new Date() } });
      if (!changed.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      await audit(tx, actor, 'TEMPLATE_PUBLISHED', 'template_version', id);
      return tx.templateVersion.findUnique({ where: { id } });
    });
  }
  retire(actor: RequestActor, id: string) {
    return this.prisma.withActor(actor, async tx => {
      await this.requireRole(tx, actor, ['ADMIN']);
      const changed = await tx.templateVersion.updateMany({ where: { id, reviewStatus: 'PUBLISHED', template: { organizationId: actor.organizationId } }, data: { reviewStatus: 'RETIRED' } });
      if (!changed.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      await audit(tx, actor, 'TEMPLATE_RETIRED', 'template_version', id);
      return tx.templateVersion.findUnique({ where: { id } });
    });
  }
}
