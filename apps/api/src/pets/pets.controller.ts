import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateObservationSchema, CreatePetSchema, InvitationSchema, PetRoleSchema, type RequestActor } from '@nuanchong/contracts';
import { z } from 'zod';
import { Actor } from '../common/actor';
import { parse } from '../common/zod';
import { PetsService } from './pets.service';

@Controller('pets')
export class PetsController {
  constructor(private readonly pets: PetsService) {}
  @Get() list(@Actor() actor: RequestActor) { return this.pets.list(actor); }
  @Get(':id/care-card') careCard(@Actor() actor: RequestActor, @Param('id') id: string) { return this.pets.careCard(actor, id); }
  @Post() create(@Actor() actor: RequestActor, @Body() body: unknown) { return this.pets.create(actor, parse(CreatePetSchema, body)); }
  @Post(':id/observations') createObservation(@Actor() actor: RequestActor, @Param('id') id: string, @Body() body: unknown) { return this.pets.createObservation(actor, id, parse(CreateObservationSchema, body)); }
  @Post(':id/members/invitations') invite(@Actor() actor: RequestActor, @Param('id') id: string, @Body() body: unknown) { return this.pets.invite(actor, id, parse(InvitationSchema, body)); }
  @Patch(':id/members/:memberId') updateMember(@Actor() actor: RequestActor, @Param('id') id: string, @Param('memberId') memberId: string, @Body() body: unknown) {
    const dto = parse(z.object({ role: PetRoleSchema.optional(), expiresAt: z.string().datetime().nullable().optional(), remove: z.boolean().optional() }), body);
    return this.pets.updateMember(actor, id, memberId, dto);
  }
}
