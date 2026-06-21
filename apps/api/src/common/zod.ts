import { BadRequestException } from '@nestjs/common';
import type { ZodSchema } from 'zod';

export function parse<T>(schema: ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException({ code: 'VALIDATION_ERROR', issues: result.error.issues });
  return result.data;
}

