import { BadRequestException, Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('public/listings')
export class PublicListingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.publicListingOverride.findMany();
  }

  @Patch(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('key') key: string, @Body() body: Record<string, unknown>) {
    if (!/^[A-Z0-9]+:[A-Z0-9.]+$/.test(key)) throw new BadRequestException('Mã căn không hợp lệ');
    const allowed = ['nightlyPrice', 'area', 'features', 'note', 'coverImage'];
    if (!body || Object.keys(body).some((field) => !allowed.includes(field))) throw new BadRequestException('Trường dữ liệu không hợp lệ');
    const nightlyPrice = body.nightlyPrice;
    if (nightlyPrice !== null && (typeof nightlyPrice !== 'number' || !Number.isSafeInteger(nightlyPrice) || nightlyPrice < 0)) throw new BadRequestException('Giá mỗi đêm không hợp lệ');
    for (const field of ['area', 'features', 'note']) {
      if (typeof body[field] !== 'string' || (body[field] as string).length > 2000) throw new BadRequestException(`${field} không hợp lệ`);
    }
    const coverImage = body.coverImage;
    if (coverImage !== undefined && coverImage !== null && (typeof coverImage !== 'string' || coverImage.length > 2048 || !/^https:\/\/lh3\.googleusercontent\.com\//.test(coverImage))) {
      throw new BadRequestException('Ảnh đại diện không hợp lệ');
    }
    const data = {
      nightlyPrice: nightlyPrice as number | null,
      area: body.area as string,
      features: body.features as string,
      note: body.note as string,
      coverImage: coverImage as string | null | undefined,
    };
    return this.prisma.publicListingOverride.upsert({ where: { key }, create: { key, ...data }, update: data });
  }
}
