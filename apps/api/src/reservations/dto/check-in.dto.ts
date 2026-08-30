import { IsOptional, IsDateString, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CheckInDto {
  @ApiPropertyOptional({ example: '2026-05-01T14:00:00Z', description: 'Giờ check-in thực tế (mặc định: now)' })
  @IsOptional()
  @IsDateString()
  actualCheckIn?: string;

  @ApiPropertyOptional({ example: 'Khách đến sớm, đã bố trí phòng' })
  @IsOptional()
  @IsString()
  notes?: string;
}
