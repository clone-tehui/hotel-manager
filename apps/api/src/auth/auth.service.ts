import { Injectable, UnauthorizedException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

function mapPermissionRole(role: any): UserRole {
  return role === 'ADMIN' ? UserRole.ADMIN : UserRole.RECEPTIONIST;
}

function toPermissionRole(role: any): 'ADMIN' | 'USER' {
  return role === UserRole.ADMIN || role === 'ADMIN' ? 'ADMIN' : 'USER';
}

function serializeUser<T extends { role?: any }>(user: T): T & { role: 'ADMIN' | 'USER' } {
  return { ...user, role: toPermissionRole(user?.role) };
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    if (user.isLocked) throw new ForbiddenException('Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    const permissionRole = toPermissionRole(user.role);
    const payload = { sub: user.id, email: user.email, role: permissionRole };
    const access_token = this.signAccess(payload);
    const refresh_token = this.signRefresh(payload);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await bcrypt.hash(refresh_token, 8), lastLoginAt: new Date() },
    });

    return {
      access_token,
      refresh_token,
      user: serializeUser({ id: user.id, email: user.email, fullName: user.fullName, role: user.role }),
    };
  }

  async refresh(token: string) {
    let payload: any;
    try {
      payload = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') + '_refresh' });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.refreshToken) throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');

    const match = await bcrypt.compare(token, user.refreshToken);
    if (!match) throw new UnauthorizedException('Refresh token không hợp lệ');

    const newPayload = { sub: user.id, email: user.email, role: toPermissionRole(user.role) };
    return { access_token: this.signAccess(newPayload) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, role: true, lastLoginAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return serializeUser(user);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) throw new UnauthorizedException('Mật khẩu cũ không đúng');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    return { ok: true, message: 'Đổi mật khẩu thành công' };
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email đã được sử dụng');

    const hashed = await bcrypt.hash(dto.password, 10);
    const created = await this.prisma.user.create({
      data: { email: dto.email, password: hashed, fullName: dto.name, role: mapPermissionRole(dto.role) },
      select: { id: true, email: true, fullName: true, role: true },
    });
    return serializeUser(created);
  }

  private signAccess(payload: object) {
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') || '1d',
    });
  }

  private signRefresh(payload: object) {
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET') + '_refresh',
      expiresIn: '30d',
    });
  }
}
