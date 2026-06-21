import { Body, Controller, Param, Post } from '@nestjs/common';
import { CreateConsentSchema, type RequestActor } from '@nuanchong/contracts';
import { Actor } from '../common/actor';
import { parse } from '../common/zod';
import { ConsentsService } from './consents.service';
@Controller('consents')
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}
  @Post() create(@Actor() actor: RequestActor, @Body() body: unknown) { return this.consents.create(actor, parse(CreateConsentSchema, body)); }
  @Post(':id/revoke') revoke(@Actor() actor: RequestActor, @Param('id') id: string) { return this.consents.revoke(actor, id); }
}

