import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReservationsService } from './reservations.service';
import { ReservationActionsService } from './reservation-actions.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { QueryReservationDto } from './dto/query-reservation.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';
import { AssignRoomDto } from './dto/assign-room.dto';
import { ChangeRoomDto } from './dto/change-room.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { ExtendReservationDto } from './dto/extend-reservation.dto';
import { QueryQuickRoomSearchDto } from './dto/query-quick-room-search.dto';

@ApiTags('Reservations')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly service: ReservationsService,
    private readonly actions: ReservationActionsService,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Danh sách đặt phòng – có filter & search' })
  findAll(@Query() q: QueryReservationDto) { return this.service.findAll(q); }

  @Get('quick-room-search')
  @ApiOperation({ summary: 'Tìm phòng nhanh theo loại phòng và/hoặc khoảng ngày giờ' })
  quickRoomSearch(@Query() q: QueryQuickRoomSearchDto) {
    return this.service.quickRoomSearch(q);
  }

  @Get('zalo-thread-lookup')
  @ApiOperation({ summary: 'Tra thread ID Zalo theo số điện thoại' })
  lookupZaloThread(@Query('phone') phone: string) {
    return this.service.lookupZaloThreadByPhone(phone);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đặt phòng' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Tạo đặt phòng mới (auto conflict-check)' })
  create(@Body() dto: CreateReservationDto, @Request() req) {
    return this.service.create(dto, req.user?.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin cơ bản' })
  update(@Param('id') id: string, @Body() dto: UpdateReservationDto, @Request() req) {
    return this.service.update(id, dto, req.user?.id);
  }

  // ── ACTIONS ───────────────────────────────────────────────────────────────

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Huỷ đặt phòng',
    description: 'Chuyển trạng thái → CANCELLED. Bắt buộc có lý do huỷ. Phòng được giải phóng về VACANT.',
  })
  cancel(@Param('id') id: string, @Body() dto: CancelReservationDto, @Request() req) {
    return this.actions.cancel(id, dto, req.user?.id);
  }

  @Post(':id/assign-room')
  @ApiOperation({
    summary: 'Gán phòng vào đặt phòng',
    description: 'Chỉ dùng khi trạng thái PENDING/BOOKED. Kiểm tra phòng không maintenance, không conflict.',
  })
  assignRoom(@Param('id') id: string, @Body() dto: AssignRoomDto, @Request() req) {
    return this.actions.assignRoom(id, dto, req.user?.id);
  }

  @Post(':id/change-room')
  @ApiOperation({
    summary: 'Đổi sang phòng khác',
    description: 'Hỗ trợ cả IN_HOUSE. Phòng cũ → DIRTY/VACANT, phòng mới → OCCUPIED/RESERVED. Kiểm tra conflict.',
  })
  changeRoom(@Param('id') id: string, @Body() dto: ChangeRoomDto, @Request() req) {
    return this.actions.changeRoom(id, dto, req.user?.id);
  }

  @Post(':id/check-in')
  @ApiOperation({
    summary: 'Check-in khách',
    description: 'Yêu cầu phòng đã được gán. Phòng → OCCUPIED. Trạng thái → IN_HOUSE.',
  })
  checkIn(@Param('id') id: string, @Body() dto: CheckInDto, @Request() req) {
    return this.actions.checkIn(id, dto, req.user?.id);
  }

  @Post(':id/check-out')
  @ApiOperation({
    summary: 'Check-out khách',
    description: 'Chỉ được khi IN_HOUSE. Phòng → DIRTY. Trạng thái → CHECKED_OUT.',
  })
  checkOut(@Param('id') id: string, @Body() dto: CheckOutDto, @Request() req) {
    return this.actions.checkOut(id, dto, req.user?.id);
  }

  @Post(':id/extend')
  @ApiOperation({
    summary: 'Gia hạn đặt phòng',
    description: 'Kéo dài ngày checkout. Tự tính lại totalNights và totalAmount. Kiểm tra conflict khoảng thời gian mới.',
  })
  extend(@Param('id') id: string, @Body() dto: ExtendReservationDto, @Request() req) {
    return this.actions.extend(id, dto, req.user?.id);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Lịch sử thao tác (audit log) của đặt phòng' })
  getLogs(@Param('id') id: string) {
    return this.actions.getLogs(id);
  }
}
