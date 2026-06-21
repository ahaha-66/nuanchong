import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { CompleteTaskSchema, CorrectTaskSchema, VersionSchema, type RequestActor } from '@nuanchong/contracts';
import { Actor } from '../common/actor';
import { parse } from '../common/zod';
import { TasksService } from './tasks.service';
@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}
  @Get('pets/:petId/tasks') list(@Actor() actor: RequestActor, @Param('petId') petId: string, @Query('from') from?: string, @Query('to') to?: string) { return this.tasks.list(actor, petId, from, to); }
  @Post('tasks/:id/claim') claim(@Actor() actor: RequestActor, @Param('id') id: string, @Body() body: unknown, @Headers('idempotency-key') _key?: string) { return this.tasks.claim(actor, id, parse(VersionSchema, body).version); }
  @Post('tasks/:id/complete') complete(@Actor() actor: RequestActor, @Param('id') id: string, @Body() body: unknown, @Headers('idempotency-key') _key?: string) { return this.tasks.complete(actor, id, parse(CompleteTaskSchema, body)); }
  @Post('tasks/:id/correct') correct(@Actor() actor: RequestActor, @Param('id') id: string, @Body() body: unknown) { return this.tasks.correct(actor, id, parse(CorrectTaskSchema, body)); }
}
