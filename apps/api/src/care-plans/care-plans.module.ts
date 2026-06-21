import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CarePlansController } from './care-plans.controller';
import { CarePlansService } from './care-plans.service';
@Module({ controllers: [CarePlansController], providers: [CarePlansService, PrismaService] })
export class CarePlansModule {}

