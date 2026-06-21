import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';
@Module({ controllers: [ConsentsController], providers: [ConsentsService, PrismaService] })
export class ConsentsModule {}

