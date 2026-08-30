import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryQuickRoomSearchDto {
  @ApiPropertyOptional({ example: 'room-type-id', description: 'ID loại phòng cần tìm' })
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @ApiPropertyOptional({ example: '2026-05-03T14:00', description: 'Check-in mong muốn (YYYY-MM-DD hoặc YYYY-MM-DDTHH:mm)' })
  @IsOptional()
  @IsString()
  checkInDate?: string;

  @ApiPropertyOptional({ example: '2026-05-06T12:00', description: 'Check-out mong muốn (YYYY-MM-DD hoặc YYYY-MM-DDTHH:mm)' })
  @IsOptional()
  @IsString()
  checkOutDate?: string;

  @ApiPropertyOptional({ example: 'building-id', description: 'Lọc thêm theo toà nhà nếu cần' })
  @IsOptional()
  @IsString()
  buildingId?: string;
}
