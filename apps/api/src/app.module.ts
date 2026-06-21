import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { AiModule } from './ai/ai.module';
import { CarePlansModule } from './care-plans/care-plans.module';
import { PrismaService } from './common/prisma.service';
import { PetsModule } from './pets/pets.module';
import { TasksModule } from './tasks/tasks.module';
import { ConsentsModule } from './consents/consents.module';
import { TimelineModule } from './timeline/timeline.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, PetsModule, CarePlansModule, TasksModule, AiModule, ConsentsModule, TimelineModule, OrganizationsModule, MediaModule],
  providers: [PrismaService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [PrismaService],
})
export class AppModule {}
