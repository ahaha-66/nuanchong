import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({ controllers: [TemplatesController], providers: [TemplatesService, PrismaService] })
export class TemplatesModule {}
