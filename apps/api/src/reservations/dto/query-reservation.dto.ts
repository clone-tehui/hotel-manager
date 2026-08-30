import { IsOptional, IsEnum, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryReservationDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Tìm theo tên khách, mã đặt phòng, công ty', example: 'Nguyễn' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional({ description: 'ID phòng' })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional({ description: 'Thread ID Zalo' })
  @IsOptional()
  @IsString()
  threadId?: string;

  @ApiPropertyOptional({ description: 'Lọc check-in từ ngày (YYYY-MM-DD)', example: '2026-05-01' })
  @IsOptional()
  @Transform(({ value }) => String(value))
  @IsString()
  checkInFrom?: string;

  @ApiPropertyOptional({ description: 'Lọc check-in đến ngày (YYYY-MM-DD)', example: '2026-05-31' })
  @IsOptional()
  @Transform(({ value }) => String(value))
  @IsString()
  checkInTo?: string;

  @ApiPropertyOptional({ description: 'Ngày cần lọc booking check-in hoặc check-out theo logic khách sạn (YYYY-MM-DD)', example: '2026-05-05' })
  @IsOptional()
  @Transform(({ value }) => String(value))
  @IsString()
  date?: string;
}
