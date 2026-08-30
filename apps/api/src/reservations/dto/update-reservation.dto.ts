import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';
import { PartialType } from '@nestjs/swagger';
import { CreateReservationDto } from './create-reservation.dto';

export class UpdateReservationDto extends PartialType(CreateReservationDto) {
  @ApiPropertyOptional({ enum: ReservationStatus, description: 'Đổi trạng thái đặt phòng' })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional({ description: 'Thời điểm check-in thực tế' })
  @IsOptional()
  @IsDateString()
  actualCheckIn?: string;

  @ApiPropertyOptional({ description: 'Thời điểm check-out thực tế' })
  @IsOptional()
  @IsDateString()
  actualCheckOut?: string;
}
