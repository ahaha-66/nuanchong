import { Body, Controller, Post } from '@nestjs/common';
import { DevLoginSchema, HospitalLoginSchema, RefreshSchema } from '@nuanchong/contracts';
import { Public } from '../common/public';
import { parse } from '../common/zod';
import { AuthService } from './auth.service';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('dev/login') dev(@Body() body: unknown) { const dto = parse(DevLoginSchema, body); return this.auth.devLogin(dto.email, dto.displayName); }
  @Post('hospital/login') hospital(@Body() body: unknown) { const dto = parse(HospitalLoginSchema, body); return this.auth.hospitalLogin(dto.email, dto.password, dto.organizationId); }
  @Post('wechat/login') wechat(@Body() body: { code?: string }) { if (!body.code) throw new Error('code is required'); return this.auth.wechatLogin(body.code); }
  @Post('refresh') refresh(@Body() body: unknown) { return this.auth.refresh(parse(RefreshSchema, body).refreshToken); }
}
