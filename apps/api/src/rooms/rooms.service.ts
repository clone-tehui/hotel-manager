import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { unlink } from 'fs/promises';
import { join } from 'path';

const ROOM_IMAGE_SELECT = {
  id: true,
  roomId: true,
  url: true,
  thumbUrl: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
};

const ROOM_INCLUDE = {
  roomType: { select: { id: true, name: true, basePrice: true, maxGuests: true } },
  building: { select: { id: true, code: true, name: true } },
  _count: { select: { images: true } },
};

function normalizeNullableNumber(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 100;
    const { status, roomTypeId, floor, buildingId, includeInactive } = query;
    const where: any = { deletedAt: null };
    if (!includeInactive) where.isActive = true;
    if (status) where.status = status;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (floor) where.floor = Number(floor);
    if (buildingId) where.buildingId = buildingId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.room.findMany({ where, include: ROOM_INCLUDE, orderBy: [{ building: { code: 'asc' } }, { number: 'asc' }], ...paginate(page, limit) }),
      this.prisma.room.count({ where }),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        ...ROOM_INCLUDE,
        images: { select: ROOM_IMAGE_SELECT, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
        reservations: {
          where: { status: { in: ['BOOKED', 'PENDING_CHECKIN', 'IN_HOUSE'] } },
          select: { id: true, reservationCode: true, primaryGuestName: true, checkInDate: true, checkOutDate: true, status: true },
          orderBy: { checkInDate: 'asc' },
          take: 5,
        },
      },
    });
    if (!room) throw new NotFoundException(`Phòng #${id} không tồn tại`);
    return room;
  }

  async create(dto: any) {
    const rt = await this.prisma.roomType.findUnique({ where: { id: dto.roomTypeId } });
    if (!rt) throw new BadRequestException('Loại phòng không tồn tại');

    const building = await this.prisma.building.findUnique({ where: { id: dto.buildingId } });
    if (!building || !building.isActive) throw new BadRequestException('Toà nhà không tồn tại hoặc không hoạt động');

    const exists = await this.prisma.room.findUnique({
      where: { buildingId_number: { buildingId: dto.buildingId, number: dto.number } },
    });
    if (exists) throw new BadRequestException(`Căn "${dto.number}" đã tồn tại trong toà này`);

    return this.prisma.room.create({
      data: {
        ...dto,
        number: String(dto.number || '').trim(),
        description: dto.description?.trim() || null,
        note: dto.note?.trim() || null,
        price: normalizeNullableNumber(dto.price),
        discountablePrice: normalizeNullableNumber(dto.discountablePrice),
        monthlyCost: normalizeNullableNumber(dto.monthlyCost),
      },
      include: ROOM_INCLUDE,
    });
  }

  async update(id: string, dto: any) {
    const room = await this.findOne(id);
    const nextBuildingId = dto.buildingId ?? room.buildingId;
    const nextRoomTypeId = dto.roomTypeId ?? room.roomTypeId;
    const nextNumber = dto.number?.trim() ?? room.number;

    if (dto.buildingId || dto.roomTypeId) {
      const activeBooking = await this.prisma.reservation.findFirst({
        where: { roomId: id, status: { in: ['BOOKED', 'PENDING_CHECKIN', 'IN_HOUSE'] } },
      });
      if (activeBooking) {
        throw new BadRequestException('Không thể đổi toà nhà hoặc loại phòng khi căn đang có booking active.');
      }
    }

    const building = await this.prisma.building.findUnique({ where: { id: nextBuildingId } });
    if (!building) throw new BadRequestException('Toà nhà không tồn tại');

    const roomType = await this.prisma.roomType.findUnique({ where: { id: nextRoomTypeId } });
    if (!roomType) throw new BadRequestException('Loại phòng không tồn tại');

    const dup = await this.prisma.room.findFirst({
      where: {
        id: { not: id },
        deletedAt: null,
        buildingId: nextBuildingId,
        number: nextNumber,
      },
    });
    if (dup) {
      throw new BadRequestException(`Căn "${nextNumber}" đã tồn tại trong toà này`);
    }

    // Business rule: building inactive => cannot change active status to active
    if (dto.isActive === true && !building?.isActive) {
      throw new BadRequestException('Không thể kích hoạt phòng trong toà nhà đã ngừng hoạt động');
    }

    return this.prisma.room.update({
      where: { id },
      data: {
        ...dto,
        number: dto.number !== undefined ? nextNumber : undefined,
        description: dto.description !== undefined ? (dto.description?.trim() || null) : undefined,
        note: dto.note !== undefined ? (dto.note?.trim() || null) : undefined,
        price: normalizeNullableNumber(dto.price),
        discountablePrice: normalizeNullableNumber(dto.discountablePrice),
        monthlyCost: normalizeNullableNumber(dto.monthlyCost),
      },
      include: ROOM_INCLUDE,
    });
  }

  async listImages(roomId: string) {
    await this.findOne(roomId);
    return this.prisma.roomImage.findMany({
      where: { roomId },
      select: ROOM_IMAGE_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async addImages(roomId: string, files: Array<{ url: string; thumbUrl?: string | null }>) {
    if (!files.length) throw new BadRequestException('Không có ảnh để lưu');
    await this.findOne(roomId);

    const currentCount = await this.prisma.roomImage.count({ where: { roomId } });
    const payload = files.map((file, index) => ({
      roomId,
      url: file.url,
      thumbUrl: file.thumbUrl ?? null,
      sortOrder: currentCount + index,
    }));

    await this.prisma.roomImage.createMany({ data: payload });
    return this.listImages(roomId);
  }

  async reorderImages(roomId: string, imageIds: string[]) {
    await this.findOne(roomId);
    const existing = await this.prisma.roomImage.findMany({ where: { roomId }, select: { id: true } });
    if (existing.length !== imageIds.length) {
      throw new BadRequestException('Danh sách ảnh không khớp');
    }

    const existingIds = new Set(existing.map((item) => item.id));
    for (const id of imageIds) {
      if (!existingIds.has(id)) {
        throw new BadRequestException('Có ảnh không thuộc căn này');
      }
    }

    await this.prisma.$transaction(
      imageIds.map((id, index) => this.prisma.roomImage.update({ where: { id }, data: { sortOrder: index } })),
    );

    return this.listImages(roomId);
  }

  async deleteImage(roomId: string, imageId: string) {
    await this.findOne(roomId);
    const image = await this.prisma.roomImage.findFirst({ where: { id: imageId, roomId } });
    if (!image) throw new NotFoundException('Ảnh không tồn tại');

    await this.prisma.roomImage.delete({ where: { id: imageId } });

    const remaining = await this.prisma.roomImage.findMany({
      where: { roomId },
      select: { id: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    await this.prisma.$transaction(
      remaining.map((item, index) => this.prisma.roomImage.update({ where: { id: item.id }, data: { sortOrder: index } })),
    );

    await Promise.allSettled(
      [image.url, image.thumbUrl]
        .filter(Boolean)
        .map((url) => {
          const normalized = String(url).replace(/^https?:\/\/[^/]+/, '');
          const relativePath = normalized.replace(/^\/uploads\//, '');
          return unlink(join(process.cwd(), 'uploads', relativePath));
        }),
    );

    return this.listImages(roomId);
  }

  async softDelete(id: string) {
    const room = await this.findOne(id);

    // Check active bookings
    const activeBooking = await this.prisma.reservation.findFirst({
      where: { roomId: id, status: { in: ['BOOKED', 'PENDING_CHECKIN', 'IN_HOUSE'] } },
    });
    if (activeBooking) {
      throw new BadRequestException('Không thể xoá phòng đang có đặt chỗ. Hãy cancel booking trước.');
    }

    return this.prisma.room.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
