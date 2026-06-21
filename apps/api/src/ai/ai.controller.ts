import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ConfirmExtractionSchema, CreateExtractionSchema, type RequestActor } from '@nuanchong/contracts';
import { Actor } from '../common/actor';
import { parse } from '../common/zod';
import { AiService } from './ai.service';
@Controller('ai/extractions')
export class AiController {
  constructor(private readonly ai: AiService) {}
  @Post() create(@Actor() actor: RequestActor, @Body() body: unknown) { return this.ai.create(actor, parse(CreateExtractionSchema, body)); }
  @Get(':id') get(@Actor() actor: RequestActor, @Param('id') id: string) { return this.ai.get(actor, id); }
  @Post(':id/confirm') confirm(@Actor() actor: RequestActor, @Param('id') id: string, @Body() body: unknown) { return this.ai.confirm(actor, id, parse(ConfirmExtractionSchema, body).result); }
}
