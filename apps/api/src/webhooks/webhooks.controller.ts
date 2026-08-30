import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Query, UseInterceptors, UploadedFile, BadRequestException, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

const imageFileFilter = (_req: any, file: any, cb: (error: any, acceptFile: boolean) => void) => {
  if (!file.mimetype?.startsWith('image/')) {
    return cb(new BadRequestException('Chỉ cho phép upload file ảnh'), false);
  }
  cb(null, true);
};

const storage = diskStorage({
  destination: '/home/node/app/uploads',
  filename: (_req, file, cb) => {
    const safeBase = file.originalname
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'image';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeBase}${extname(file.originalname) || '.png'}`);
  },
});

@ApiTags('Webhooks & Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller()
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  // ─── Webhook Integrations CRUD ────────────────────────────────────────────────

  @Get('webhooks')
  @ApiOperation({ summary: 'Danh sách tất cả webhook integrations' })
  async listWebhooks() {
    const data = await this.prisma.webhookIntegration.findMany({ orderBy: { createdAt: 'asc' } });
    return { ok: true, data };
  }

  @Post('webhooks')
  @ApiOperation({ summary: 'Tạo webhook integration mới' })
  async createWebhook(@Body() body: { name: string; url: string; secret?: string; events?: string[]; isActive?: boolean }) {
    const data = await this.prisma.webhookIntegration.create({
      data: {
        name: body.name,
        url: body.url,
        secret: body.secret,
        events: body.events ?? [
          'reservation.created', 'reservation.updated', 'reservation.cancelled',
          'reservation.checked_in', 'reservation.checked_out',
        ],
        isActive: body.isActive ?? true,
      },
    });
    return { ok: true, data };
  }

  @Patch('webhooks/:id')
  @ApiOperation({ summary: 'Cập nhật webhook integration' })
  async updateWebhook(@Param('id') id: string, @Body() body: any) {
    const data = await this.prisma.webhookIntegration.update({ where: { id }, data: body });
    return { ok: true, data };
  }

  @Delete('webhooks/:id')
  @ApiOperation({ summary: 'Xoá webhook integration' })
  async deleteWebhook(@Param('id') id: string) {
    await this.prisma.webhookIntegration.delete({ where: { id } });
    return { ok: true };
  }

  @Post('webhooks/:id/test')
  @ApiOperation({ summary: 'Test một webhook cụ thể' })
  async testSpecificWebhook(@Param('id') id: string) {
    return this.webhooksService.testWebhook(id);
  }

  @Post('webhooks/test')
  @ApiOperation({ summary: 'Test webhook payload (chọn 1 integration bất kỳ đang active để test)' })
  async testWebhook(@Body() body: { webhookId?: string }) {
    let wid = body.webhookId;
    if (!wid) {
      const active = await this.prisma.webhookIntegration.findFirst({ where: { isActive: true } });
      if (active) wid = active.id;
    }
    if (!wid) return { success: false, message: 'No active webhooks found' };
    return this.webhooksService.testWebhook(wid);
  }

  @Get('integrations/n8n/logs')
  @ApiOperation({ summary: 'Lấy logs delivery của integration' })
  async getN8nLogs(@Query('limit') limit: number = 50) {
    const logs = await this.prisma.webhookDeliveryLog.findMany({
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { webhook: { select: { name: true, url: true } } },
    });
    return { ok: true, data: logs };
  }

  // ─── System Settings ──────────────────────────────────────────────────────────

  @Get('system/settings')
  @Roles('ADMIN', 'USER')
  @ApiOperation({ summary: 'Lấy tất cả cài đặt hệ thống' })
  async getSettings() {
    const settings = await this.prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    settings.forEach(s => { map[s.key] = s.value; });
    return { ok: true, data: map };
  }

  @Patch('system/settings')
  @ApiOperation({ summary: 'Cập nhật cài đặt hệ thống (key-value)' })
  async updateSettings(@Body() body: Record<string, string>) {
    const updates = Object.entries(body).map(([key, value]) =>
      this.prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    );
    await this.prisma.$transaction(updates);
    return { ok: true, message: 'Cài đặt đã được lưu' };
  }

  @Post('system/settings/upload-image')
  @ApiOperation({ summary: 'Upload ảnh cho logo hệ thống hoặc avatar admin' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadSystemImage(@UploadedFile() file: any, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file ảnh');
    }

    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
    const relativePath = `/uploads/${file.filename}`;
    const url = `${proto}://${host}${relativePath}`;

    return {
      ok: true,
      data: {
        filename: file.filename,
        relativePath,
        url,
      },
    };
  }
}
