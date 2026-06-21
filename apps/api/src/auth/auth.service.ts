import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  private hashRefresh(token: string) { return createHash('sha256').update(token + (process.env.JWT_REFRESH_PEPPER ?? 'dev-pepper')).digest('hex'); }
  private async issue(userId: string) {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.session.create({ data: { userId, refreshTokenHash: this.hashRefresh(refreshToken), expiresAt: new Date(Date.now() + 30 * 86400000) } });
    return { accessToken: this.jwt.sign({ sub: userId }), refreshToken };
  }
  async devLogin(email: string, displayName?: string) {
    if (process.env.NODE_ENV === 'production') throw new UnauthorizedException('Development login is disabled');
    const user = await this.prisma.user.upsert({ where: { email }, update: {}, create: { email, displayName: displayName ?? email.split('@')[0] } });
    return { user, ...(await this.issue(user.id)) };
  }
  async hospitalLogin(email: string, password: string, organizationId?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password))) throw new UnauthorizedException({ code: 'UNAUTHORIZED' });
    if (organizationId) {
      const member = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: user.id } } });
      if (!member) throw new UnauthorizedException({ code: 'UNAUTHORIZED' });
    }
    return { user, organizationId, ...(await this.issue(user.id)) };
  }
  async wechatLogin(code: string) {
    const appId = process.env.WECHAT_APP_ID;
    const secret = process.env.WECHAT_APP_SECRET;
    if (!appId || !secret) throw new UnauthorizedException('WeChat authentication is not configured');
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.search = new URLSearchParams({ appid: appId, secret, js_code: code, grant_type: 'authorization_code' }).toString();
    const response = await fetch(url);
    const data = await response.json() as { openid?: string; errmsg?: string };
    if (!data.openid) throw new UnauthorizedException(data.errmsg ?? 'WeChat login failed');
    const identity = await this.prisma.authIdentity.findUnique({ where: { provider_subject: { provider: 'wechat', subject: data.openid } }, include: { user: true } });
    const user = identity?.user ?? await this.prisma.user.create({ data: { displayName: '微信用户', identities: { create: { provider: 'wechat', subject: data.openid } } } });
    return { user, ...(await this.issue(user.id)) };
  }
  async refresh(refreshToken: string) {
    const hash = this.hashRefresh(refreshToken);
    const session = await this.prisma.session.findFirst({ where: { refreshTokenHash: hash, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!session) throw new UnauthorizedException({ code: 'UNAUTHORIZED' });
    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.issue(session.userId);
  }
}

