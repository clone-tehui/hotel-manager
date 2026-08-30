import { IsString, IsOptional, IsNumber, IsPositive, IsBoolean, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRoomTypeDto {
  @ApiProperty({ example: 'Deluxe' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Phòng cao cấp view biển' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 850000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  basePrice: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxGuests?: number;

  @ApiPropertyOptional({ example: ['WiFi', 'TV', 'Điều hòa'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}
