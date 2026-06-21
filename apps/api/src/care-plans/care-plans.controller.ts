import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateCarePlanSchema, VersionSchema, type RequestActor } from '@nuanchong/contracts';
import { Actor } from '../common/actor';
import { parse } from '../common/zod';
import { CarePlansService } from './care-plans.service';
@Controller('care-plans')
export class CarePlansController {
  constructor(private readonly plans: CarePlansService) {}
  @Get('pet/:petId') list(@Actor() actor: RequestActor, @Param('petId') petId: string) { return this.plans.listForPet(actor, petId); }
  @Post() create(@Actor() actor: RequestActor, @Body() body: unknown) { return this.plans.create(actor, parse(CreateCarePlanSchema, body)); }
  @Post(':id/publish') publish(@Actor() actor: RequestActor, @Param('id') id: string, @Body() body: unknown) { return this.plans.publish(actor, id, parse(VersionSchema, body).version); }
  @Post(':id/confirm') confirm(@Actor() actor: RequestActor, @Param('id') id: string, @Body() body: unknown) { return this.plans.confirm(actor, id, parse(VersionSchema, body).version); }
}
