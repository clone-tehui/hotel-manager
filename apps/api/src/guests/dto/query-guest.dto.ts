import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Type } from 'class-transformer';

export class QueryGuestDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Tìm theo tên, email hoặc số điện thoại', example: 'Nguyễn' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Chỉ hiện khách VIP' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isVip?: boolean;
}
