import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { OrganizationsController } from './organizations.controller';
@Module({ controllers: [OrganizationsController], providers: [PrismaService] })
export class OrganizationsModule {}

