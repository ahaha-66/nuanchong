import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CompleteFollowupSchema, CreateFollowupDefinitionSchema, CreateFollowupSchema, SubmitFollowupSchema, type RequestActor } from '@nuanchong/contracts';
import { Actor } from '../common/actor';
import { parse } from '../common/zod';
import { FollowupsService } from './followups.service';

@Controller()
export class FollowupsController {
  constructor(private readonly followups: FollowupsService) {}
  @Post('followup-definitions') createDefinition(@Actor() actor: RequestActor, @Body() body: unknown) { return this.followups.createDefinition(actor, parse(CreateFollowupDefinitionSchema, body)); }
  @Get('followup-definitions') definitions(@Actor() actor: RequestActor) { return this.followups.definitions(actor); }
  @Post('followups') create(@Actor() actor: RequestActor, @Body() body: unknown) { return this.followups.create(actor, parse(CreateFollowupSchema, body)); }
  @Get('pets/:petId/followups') forPet(@Actor() actor: RequestActor, @Param('petId') petId: string) { return this.followups.forPet(actor, petId); }
  @Get('organizations/:organizationId/followup-queue') queue(@Actor() actor: RequestActor, @Param('organizationId') organizationId: string) { return this.followups.queue({ ...actor, organizationId }); }
  @Get('followups/:id') get(@Actor() actor: RequestActor, @Param('id') id: string) { return this.followups.get(actor, id); }
  @Post('followups/:id/submit') submit(@Actor() actor: RequestActor, @Param('id') id: string, @Body() body: unknown) { return this.followups.submit(actor, id, parse(SubmitFollowupSchema, body)); }
  @Post('followups/:id/claim') claim(@Actor() actor: RequestActor, @Param('id') id: string) { return this.followups.claim(actor, id); }
  @Post('followups/:id/complete') complete(@Actor() actor: RequestActor, @Param('id') id: string, @Body() body: unknown) { return this.followups.complete(actor, id, parse(CompleteFollowupSchema, body)); }
}
