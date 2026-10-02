import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { API_KEY_SCOPE } from './api-key-scope.decorator';
import { pricingError } from '../pricing/pricing-error';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const raw = request.headers['x-api-key'];
    if (typeof raw !== 'string' || !/^hk_[a-f0-9]{48}$/.test(raw)) pricingError('INVALID_API_KEY', 401);
    const candidates = await this.prisma.apiKey.findMany({ where: { keyPrefix: raw.slice(0, 8), isActive: true } });
    for (const candidate of candidates) {
      if (!await bcrypt.compare(raw, candidate.keyHash)) continue;
      const scope = this.reflector.get<string>(API_KEY_SCOPE, context.getHandler());
      if (!scope || !candidate.scopes.includes(scope)) pricingError('INSUFFICIENT_SCOPE', 403);
      await this.prisma.apiKey.update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } });
      request.apiKey = { id: candidate.id, scopes: candidate.scopes };
      return true;
    }
    pricingError('INVALID_API_KEY', 401);
  }
}
