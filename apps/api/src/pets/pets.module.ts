import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';
@Module({ controllers: [PetsController], providers: [PetsService, PrismaService] })
export class PetsModule {}

