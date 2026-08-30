import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GuestsService } from './guests.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { QueryGuestDto } from './dto/query-guest.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Guests')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('guests')
export class GuestsController {
  constructor(private service: GuestsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách khách hàng – search theo ?q=tên/phone/email' })
  findAll(@Query() query: QueryGuestDto) { return this.service.findAll(query); }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết khách hàng + lịch sử đặt phòng' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Tạo khách hàng mới' })
  create(@Body() dto: CreateGuestDto) { return this.service.create(dto); }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin khách hàng' })
  update(@Param('id') id: string, @Body() dto: UpdateGuestDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoá khách hàng khi chưa phát sinh lịch sử booking' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
