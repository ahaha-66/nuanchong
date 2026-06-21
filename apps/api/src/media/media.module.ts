import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { MediaController } from './media.controller';
@Module({ controllers: [MediaController], providers: [PrismaService] })
export class MediaModule {}

