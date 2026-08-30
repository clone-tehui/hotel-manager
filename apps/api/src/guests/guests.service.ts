import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { QueryGuestDto } from './dto/query-guest.dto';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class GuestsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryGuestDto) {
    const { page = 1, limit = 20, q, isVip } = query;
    const where: any = {};

    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email:    { contains: q, mode: 'insensitive' } },
        { phone:    { contains: q, mode: 'insensitive' } },
        { idNumber: { contains: q, mode: 'insensitive' } },
        { company:  { contains: q, mode: 'insensitive' } },
      ];
    }
    if (isVip !== undefined) where.isVip = isVip;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.guest.findMany({
        where,
        orderBy: { fullName: 'asc' },
        ...paginate(page, limit),
        include: { _count: { select: { reservationGuests: true } } },
      }),
      this.prisma.guest.count({ where }),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const guest = await this.prisma.guest.findUnique({
      where: { id },
      include: {
        reservationGuests: {
          include: {
            reservation: {
              select: {
                id: true, reservationCode: true, checkInDate: true,
                checkOutDate: true, status: true, totalAmount: true,
                room: { select: { number: true } },
              },
            },
          },
          orderBy: { reservation: { checkInDate: 'desc' } },
          take: 10,
        },
      },
    });
    if (!guest) throw new NotFoundException(`Khách hàng #${id} không tồn tại`);
    return guest;
  }

  async create(dto: CreateGuestDto) {
    if (dto.idNumber) {
      const exists = await this.prisma.guest.findUnique({ where: { idNumber: dto.idNumber } });
      if (exists) throw new ConflictException(`CMND/Hộ chiếu "${dto.idNumber}" đã được đăng ký`);
    }
    return this.prisma.guest.create({ data: dto });
  }

  async update(id: string, dto: UpdateGuestDto) {
    await this.findOne(id);

    if (dto.idNumber) {
      const dup = await this.prisma.guest.findFirst({
        where: { idNumber: dto.idNumber, id: { not: id } },
      });
      if (dup) throw new ConflictException(`CMND/Hộ chiếu "${dto.idNumber}" đã được đăng ký cho khách khác`);
    }
    return this.prisma.guest.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);

    const links = await this.prisma.reservationGuest.count({ where: { guestId: id } });
    if (links > 0) {
      throw new BadRequestException('Không thể xoá khách đã có lịch sử booking. Hãy giữ hồ sơ để bảo toàn dữ liệu vận hành.');
    }

    return this.prisma.guest.delete({ where: { id } });
  }
}
