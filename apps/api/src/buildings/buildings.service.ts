import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BuildingsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.building.findMany({ orderBy: { code: 'asc' } });
  }

  async findOne(id: string) {
    const b = await this.prisma.building.findUnique({
      where: { id },
      include: { rooms: { include: { roomType: true }, orderBy: { number: 'asc' } } },
    });
    if (!b) throw new NotFoundException(`Toà nhà #${id} không tồn tại`);
    return b;
  }

  async create(dto: any) {
    const normalizedCode = dto.code?.trim().toUpperCase();
    const exists = await this.prisma.building.findUnique({ where: { code: normalizedCode } });
    if (exists) throw new ConflictException('Mã toà nhà đã tồn tại');
    return this.prisma.building.create({
      data: {
        ...dto,
        code: normalizedCode,
        name: dto.name?.trim(),
        address: dto.address?.trim() || null,
        note: dto.note?.trim() || null,
      },
    });
  }

  async update(id: string, dto: any) {
    await this.findOne(id);

    const data: any = {
      ...dto,
      name: dto.name !== undefined ? dto.name?.trim() : undefined,
      address: dto.address !== undefined ? (dto.address?.trim() || null) : undefined,
      note: dto.note !== undefined ? (dto.note?.trim() || null) : undefined,
    };

    if (dto.code !== undefined) {
      const normalizedCode = dto.code.trim().toUpperCase();
      const dup = await this.prisma.building.findFirst({
        where: { code: normalizedCode, id: { not: id } },
      });
      if (dup) throw new ConflictException('Mã toà nhà đã tồn tại');
      data.code = normalizedCode;
    }

    return this.prisma.building.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);

    const roomCount = await this.prisma.room.count({
      where: { buildingId: id },
    });
    if (roomCount > 0) {
      throw new BadRequestException('Không thể xoá toà nhà vẫn còn bản ghi căn/phòng, kể cả phòng đã ẩn/xoá mềm. Hãy xử lý toàn bộ phòng trước.');
    }

    return this.prisma.building.delete({ where: { id } });
  }
}
