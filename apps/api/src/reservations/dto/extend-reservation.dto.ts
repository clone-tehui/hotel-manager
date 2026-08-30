import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExtendReservationDto {
  @ApiProperty({ example: '2026-05-06', description: 'Ngày checkout mới (phải sau ngày checkout hiện tại)' })
  @IsDateString()
  newCheckOutDate: string;

  @ApiPropertyOptional({ example: 'Khách muốn ở thêm 3 đêm' })
  @IsOptional()
  @IsString()
  reason?: string;
}
