import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.apiKey.findMany({
      select: { id: true, name: true, keyPrefix: true, scopes: true, isActive: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: { name: string; scopes?: string[] }) {
    // Generate a random 32-byte key
    const rawKey = `hk_${crypto.randomBytes(24).toString('hex')}`;
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = await bcrypt.hash(rawKey, 10);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        keyPrefix,
        keyHash,
        scopes: dto.scopes ?? [],
      },
    });

    // Return full key ONCE – it won't be shown again
    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
      key: rawKey, // shown only once
    };
  }

  async revoke(id: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException('API Key không tồn tại');
    await this.prisma.apiKey.update({ where: { id }, data: { isActive: false } });
    return { ok: true, message: 'API Key đã bị thu hồi' };
  }
}
