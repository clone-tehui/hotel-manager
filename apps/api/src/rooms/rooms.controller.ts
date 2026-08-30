import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFiles, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { unlink } from 'fs/promises';
import * as sharp from 'sharp';

const roomUploadsTempDir = '/home/node/app/uploads/tmp';
const roomUploadsDir = '/home/node/app/uploads/rooms';
const roomThumbsDir = '/home/node/app/uploads/rooms/thumbs';

for (const dir of [roomUploadsTempDir, roomUploadsDir, roomThumbsDir]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const roomImageStorage = diskStorage({
  destination: roomUploadsTempDir,
  filename: (_req, file, cb) => {
    const safeBase = file.originalname
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'room';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeBase}${extname(file.originalname) || '.jpg'}`);
  },
});

const roomImageFilter = (_req: any, file: any, cb: (error: any, acceptFile: boolean) => void) => {
  if (!file.mimetype?.startsWith('image/')) return cb(new BadRequestException('Chỉ cho phép upload file ảnh'), false);
  cb(null, true);
};

@ApiTags('Rooms')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private service: RoomsService) {}

  private async processRoomImages(req: any, files: any[]) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host');

    return Promise.all(files.map(async (file) => {
      const baseName = file.filename.replace(/\.[^/.]+$/, '');
      const mainName = `${baseName}.webp`;
      const thumbName = `${baseName}-thumb.webp`;
      const mainAbsolutePath = join(roomUploadsDir, mainName);
      const thumbAbsolutePath = join(roomThumbsDir, thumbName);

      try {
        await sharp(file.path)
          .rotate()
          .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(mainAbsolutePath);

        await sharp(file.path)
          .rotate()
          .resize({ width: 420, height: 420, fit: 'cover', position: 'attention' })
          .webp({ quality: 72 })
          .toFile(thumbAbsolutePath);

        return {
          url: `${proto}://${host}/uploads/rooms/${mainName}`,
          thumbUrl: `${proto}://${host}/uploads/rooms/thumbs/${thumbName}`,
        };
      } finally {
        await unlink(file.path).catch(() => undefined);
      }
    }));
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách phòng – filter buildingId, status, roomTypeId' })
  findAll(@Query() query: any) { return this.service.findAll(query); }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết phòng + booking hiện tại' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Tạo phòng mới (yêu cầu buildingId + roomTypeId)' })
  @Roles('ADMIN')
  create(@Body() dto: any) { return this.service.create(dto); }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật phòng (trạng thái, isActive, note...)' })
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Get(':id/images')
  @ApiOperation({ summary: 'Danh sách ảnh của căn hộ' })
  listImages(@Param('id') id: string) {
    return this.service.listImages(id);
  }

  @Post(':id/images/upload')
  @ApiOperation({ summary: 'Upload nhiều ảnh cho căn hộ' })
  @Roles('ADMIN')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
      required: ['files'],
    },
  })
  @UseInterceptors(FilesInterceptor('files', 20, { storage: roomImageStorage, fileFilter: roomImageFilter, limits: { fileSize: 40 * 1024 * 1024 } }))
  async uploadImages(@Param('id') id: string, @UploadedFiles() files: any[], @Req() req: any) {
    if (!files?.length) throw new BadRequestException('Vui lòng chọn ít nhất 1 ảnh');
    const processed = await this.processRoomImages(req, files);
    return this.service.addImages(id, processed);
  }

  @Patch(':id/images/reorder')
  @ApiOperation({ summary: 'Sắp xếp lại thứ tự ảnh của căn hộ' })
  @Roles('ADMIN')
  reorderImages(@Param('id') id: string, @Body() body: { imageIds: string[] }) {
    return this.service.reorderImages(id, body.imageIds ?? []);
  }

  @Delete(':id/images/:imageId')
  @ApiOperation({ summary: 'Xoá một ảnh của căn hộ' })
  @Roles('ADMIN')
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.service.deleteImage(id, imageId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete phòng (chỉ khi không có booking active)' })
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.softDelete(id);
  }
}
