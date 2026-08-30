import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const rawAuthHeader = req.headers?.authorization;
    const bearerToken = typeof rawAuthHeader === 'string' && rawAuthHeader.startsWith('Bearer ')
      ? rawAuthHeader.slice(7).trim()
      : undefined;
    const xApiKey = Array.isArray(req.headers?.['x-api-key'])
      ? req.headers['x-api-key'][0]
      : req.headers?.['x-api-key'];
    const apiKeyCandidate = String(xApiKey || '').trim() || (bearerToken?.startsWith('hk_') ? bearerToken : '');

    if (apiKeyCandidate) {
      req.user = await this.validateApiKey(apiKeyCandidate);
      return true;
    }

    const result = await super.canActivate(context);
    return !!result;
  }

  private async validateApiKey(rawKey: string) {
    if (!rawKey.startsWith('hk_') || rawKey.length < 8) {
      throw new UnauthorizedException('Unauthorized');
    }

    const keyPrefix = rawKey.substring(0, 8);
    const candidates = await this.prisma.apiKey.findMany({
      where: { keyPrefix, isActive: true },
      select: { id: true, name: true, keyHash: true, scopes: true },
    });

    for (const candidate of candidates) {
      const matched = await bcrypt.compare(rawKey, candidate.keyHash);
      if (!matched) continue;

      await this.prisma.apiKey.update({
        where: { id: candidate.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        id: `api-key:${candidate.id}`,
        email: null,
        fullName: candidate.name,
        role: 'ADMIN',
        authType: 'apiKey',
        apiKeyId: candidate.id,
        apiKeyName: candidate.name,
        scopes: candidate.scopes ?? [],
      };
    }

    throw new UnauthorizedException('Unauthorized');
  }
}
