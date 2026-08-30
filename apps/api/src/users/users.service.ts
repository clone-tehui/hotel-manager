import { UserRole } from '@prisma/client';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

function toPermissionRole(role: any): 'ADMIN' | 'USER' {
  return role === UserRole.ADMIN || role === 'ADMIN' ? 'ADMIN' : 'USER';
}

function serializeUser<T extends { role?: any }>(user: T): T & { role: 'ADMIN' | 'USER' } {
  return { ...user, role: toPermissionRole(user?.role) };
}

function mapPermissionRole(role: any): UserRole | undefined {
  if (!role) return undefined;
  if (role === 'ADMIN') return UserRole.ADMIN;
  // v1: any non-admin input becomes USER tier, stored as RECEPTIONIST for compatibility
  if (role === 'USER') return UserRole.RECEPTIONIST;
  return role as UserRole;
}

const USER_SELECT = {
  id: true, email: true, fullName: true, role: true,
  isActive: true, isLocked: true, lastLoginAt: true, createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(params?: { page?: any; limit?: any; q?: string }) {
    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 20;
    const q = params?.q;
    const where: any = q
      ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: USER_SELECT, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.user.count({ where }),
    ]);
    return { data: items.map(serializeUser), meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundException(`User #${id} không tồn tại`);
    return serializeUser(user);
  }

  async create(dto: { email: string; password: string; fullName: string; role?: any }) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email đã được sử dụng');
    const hashed = await bcrypt.hash(dto.password, 10);
    const created = await this.prisma.user.create({
      data: { ...dto, role: mapPermissionRole(dto.role) ?? undefined, password: hashed },
      select: USER_SELECT,
    });
    return serializeUser(created);
  }

  async update(id: string, dto: { fullName?: string; role?: any; isActive?: boolean }) {
    await this.findOne(id);
    const updated = await this.prisma.user.update({ where: { id }, data: { ...dto, role: mapPermissionRole(dto.role) ?? undefined }, select: USER_SELECT });
    return serializeUser(updated);
  }

  async setPassword(id: string, newPassword: string) {
    await this.findOne(id);
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { password: hashed } });
    return { ok: true, message: 'Mật khẩu đã được cập nhật' };
  }

  async lock(id: string) {
    await this.findOne(id);
    await this.prisma.user.update({ where: { id }, data: { isLocked: true } });
    return { ok: true, message: 'Tài khoản đã bị khoá' };
  }

  async unlock(id: string) {
    await this.findOne(id);
    await this.prisma.user.update({ where: { id }, data: { isLocked: false } });
    return { ok: true, message: 'Tài khoản đã được mở khoá' };
  }
}
