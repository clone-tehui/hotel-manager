import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoomTypesService } from './room-types.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Room Types')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('room-types')
export class RoomTypesController {
  constructor(private service: RoomTypesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách loại phòng' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết loại phòng' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Tạo loại phòng mới' })
  @Roles('ADMIN')
  create(@Body() dto: CreateRoomTypeDto) { return this.service.create(dto); }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật loại phòng' })
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateRoomTypeDto) {
    return this.service.update(id, dto);
  }
}
