import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import type { RequestActor } from '@nuanchong/contracts';
import { randomUUID } from 'node:crypto';
import { Actor } from '../common/actor';
import { PrismaService } from '../common/prisma.service';
@Controller('media')
export class MediaController {
  constructor(private readonly prisma: PrismaService) {}
  @Post('upload-tickets')
  async ticket(@Actor() actor: RequestActor, @Body() body: { petId?: string; contentType?: string; byteSize?: number }) {
    if (!body.petId || !body.contentType || !body.byteSize) throw new BadRequestException('petId, contentType and byteSize are required');
    if (!['audio/mpeg', 'audio/mp4', 'audio/wav', 'image/jpeg', 'image/png', 'video/mp4'].includes(body.contentType) || body.byteSize > 20 * 1024 * 1024) throw new BadRequestException('Unsupported media type or size');
    const objectKey = `pets/${body.petId}/${randomUUID()}`;
    const asset = await this.prisma.withActor(actor, tx => tx.mediaAsset.create({ data: { petId: body.petId!, ownerUserId: actor.userId, objectKey, contentType: body.contentType!, byteSize: body.byteSize! } }));
    return { asset, uploadUrl: `${process.env.OBJECT_STORAGE_ENDPOINT ?? 'http://localhost:9000'}/${process.env.OBJECT_STORAGE_BUCKET ?? 'nuanchong-private'}/${objectKey}?expires=900`, expiresIn: 900 };
  }
}
