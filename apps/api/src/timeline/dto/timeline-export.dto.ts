import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TimelineExportDto {
  @ApiPropertyOptional({ description: 'Từ ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: 'ID toà nhà để lọc dữ liệu export' })
  @IsOptional()
  @IsString()
  buildingId?: string;

  @ApiPropertyOptional({ description: 'Trạng thái (ví dụ: BOOKED, IN_HOUSE, CHECKED_OUT)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Định dạng (xlsx, csv)' })
  @IsOptional()
  @IsEnum(['xlsx', 'csv'])
  format?: 'xlsx' | 'csv' = 'xlsx';
}
