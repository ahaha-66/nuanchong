import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestActor } from '@nuanchong/contracts';

export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestActor => {
  return ctx.switchToHttp().getRequest<{ actor: RequestActor }>().actor;
});

