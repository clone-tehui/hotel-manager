import { IsString, IsInt, IsOptional, Min, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRoomDto {
  @ApiProperty({ example: '101' })
  @IsString()
  number: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  floor: number;

  @ApiProperty({ example: 'room-type-id-here' })
  @IsString()
  roomTypeId: string;

  @ApiProperty({ example: 'building-id-here' })
  @IsString()
  buildingId: string;

  @ApiPropertyOptional({ example: 2900000, description: 'Giá bán/đêm (VNĐ)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 2500000, description: 'Giá có thể giảm/đêm (VNĐ)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountablePrice?: number;

  @ApiPropertyOptional({ example: 70000000, description: 'Giá vốn vận hành theo tháng (VNĐ), chỉ dùng nội bộ cho báo cáo' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyCost?: number;

  @ApiPropertyOptional({ example: 'Phòng hướng biển, ban công rộng' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Có bồn tắm, thang máy riêng' })
  @IsOptional()
  @IsString()
  note?: string;
}
