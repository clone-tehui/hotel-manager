import { IsOptional, IsDateString, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CheckOutDto {
  @ApiPropertyOptional({ example: '2026-05-03T11:00:00Z', description: 'Giờ check-out thực tế (mặc định: now)' })
  @IsOptional()
  @IsDateString()
  actualCheckOut?: string;

  @ApiPropertyOptional({ example: 'Khách trả phòng sớm' })
  @IsOptional()
  @IsString()
  notes?: string;
}
