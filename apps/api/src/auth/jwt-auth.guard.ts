import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { RequestActor } from '@nuanchong/contracts';
import { IS_PUBLIC } from '../common/public';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService) {}
  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; actor?: RequestActor }>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException({ code: 'UNAUTHORIZED' });
    try {
      const payload = this.jwt.verify<{ sub: string }>(token);
      request.actor = {
        userId: payload.sub,
        organizationId: request.headers['x-organization-id'],
        supportAccessId: request.headers['x-support-access-id'],
      };
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED' });
    }
  }
}

