import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { FollowupsController } from './followups.controller';
import { FollowupsService } from './followups.service';

@Module({ controllers: [FollowupsController], providers: [FollowupsService, PrismaService] })
export class FollowupsModule {}
