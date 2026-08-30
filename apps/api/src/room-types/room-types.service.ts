import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';

@Injectable()
export class RoomTypesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.roomType.findMany({
      where: { isActive: true },
      include: { _count: { select: { rooms: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const rt = await this.prisma.roomType.findUnique({
      where: { id },
      include: { rooms: { select: { id: true, number: true, floor: true, status: true } } },
    });
    if (!rt) throw new NotFoundException(`Loại phòng #${id} không tồn tại`);
    return rt;
  }

  async create(dto: CreateRoomTypeDto) {
    const exists = await this.prisma.roomType.findUnique({ where: { name: dto.name } });
    if (exists) throw new ConflictException(`Loại phòng "${dto.name}" đã tồn tại`);

    return this.prisma.roomType.create({
      data: {
        name: dto.name,
        description: dto.description,
        basePrice: dto.basePrice,
        maxGuests: dto.maxGuests ?? 2,
        amenities: dto.amenities ?? [],
      },
    });
  }

  async update(id: string, dto: UpdateRoomTypeDto) {
    await this.findOne(id);
    return this.prisma.roomType.update({ where: { id }, data: dto });
  }
}
