import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateTemplateSchema, CreateTemplateVersionSchema, ReviewTemplateSchema, type RequestActor } from '@nuanchong/contracts';
import { Actor } from '../common/actor';
import { parse } from '../common/zod';
import { TemplatesService } from './templates.service';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}
  @Get() list(@Actor() actor: RequestActor) { return this.templates.list(actor); }
  @Post() create(@Actor() actor: RequestActor, @Body() body: unknown) { return this.templates.create(actor, parse(CreateTemplateSchema, body)); }
  @Post(':id/versions') createVersion(@Actor() actor: RequestActor, @Param('id') id: string, @Body() body: unknown) { return this.templates.createVersion(actor, id, parse(CreateTemplateVersionSchema, body)); }
  @Post('versions/:id/submit-review') submitReview(@Actor() actor: RequestActor, @Param('id') id: string) { return this.templates.submitReview(actor, id); }
  @Post('versions/:id/review') review(@Actor() actor: RequestActor, @Param('id') id: string, @Body() body: unknown) { return this.templates.review(actor, id, parse(ReviewTemplateSchema, body)); }
  @Post('versions/:id/publish') publish(@Actor() actor: RequestActor, @Param('id') id: string) { return this.templates.publish(actor, id); }
  @Post('versions/:id/retire') retire(@Actor() actor: RequestActor, @Param('id') id: string) { return this.templates.retire(actor, id); }
}
