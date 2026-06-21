import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AiController } from './ai.controller';
import { AI_PROVIDER, AiService } from './ai.service';
import { FakeAiProvider } from './fake.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
@Module({
  controllers: [AiController],
  providers: [PrismaService, AiService, FakeAiProvider, OpenAiCompatibleProvider, { provide: AI_PROVIDER, useFactory: (fake: FakeAiProvider, real: OpenAiCompatibleProvider) => process.env.AI_USE_FAKE === 'true' ? fake : real, inject: [FakeAiProvider, OpenAiCompatibleProvider] }],
})
export class AiModule {}

