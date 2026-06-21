import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TimelineController } from './timeline.controller';
@Module({ controllers: [TimelineController], providers: [PrismaService] })
export class TimelineModule {}

