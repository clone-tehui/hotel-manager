import { IsOptional, IsPositive, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Max(500)
  limit?: number = 20;
}

export function paginate(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  return { skip, take: limit };
}

export function paginatedResponse<T>(items: T[], total: number, page: number, limit: number) {
  return {
    data: items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
