import { IsString, IsOptional, IsInt, IsNumber, IsPositive, IsDateString, IsArray, Min, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateReservationDto {
  @ApiProperty({ example: 'room-id-here', description: 'ID phòng' })
  @IsString()
  roomId: string;

  @ApiProperty({ example: 'Nguyễn Văn An', description: 'Tên khách chính' })
  @IsString()
  primaryGuestName: string;

  @ApiPropertyOptional({ example: 'Công ty TNHH ABC', description: 'Công ty (để xuất hóa đơn)' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiProperty({ example: '2026-05-01', description: 'Ngày đến (YYYY-MM-DD)' })
  @IsDateString()
  checkInDate: string;

  @ApiProperty({ example: '2026-05-03', description: 'Ngày đi (YYYY-MM-DD)' })
  @IsDateString()
  checkOutDate: string;

  @ApiPropertyOptional({ example: 2, description: 'Số người lớn (NL)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adults?: number;

  @ApiPropertyOptional({ example: 1, description: 'Số trẻ em (TE)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  children?: number;

  @ApiPropertyOptional({ example: 'Standard Rate', description: 'Loại giá' })
  @IsOptional()
  @IsString()
  ratePlanName?: string;

  @ApiProperty({ example: 850000, description: 'Giá mỗi đêm (VNĐ)' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  pricePerNight: number;

  @ApiPropertyOptional({ example: 200000, description: 'Tiền giảm giá' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ example: 500000, description: 'Tiền cọc' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiProperty({ example: 'airbnb', description: 'Nền tảng đặt phòng', enum: ['airbnb', 'zalo', 'sale', 'khac'] })
  @IsString()
  @IsIn(['airbnb', 'zalo', 'sale', 'khac'])
  source: string;

  @ApiPropertyOptional({ example: '1797862434179915711', description: 'Thread ID Zalo nếu booking đến từ hội thoại Zalo' })
  @IsOptional()
  @IsString()
  threadId?: string;

  @ApiPropertyOptional({ example: 'Khách yêu cầu phòng yên tĩnh', description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'Khách đã thanh toán qua Booking.com', description: 'Ghi chú nội bộ' })
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional({ example: ['guest-id-1', 'guest-id-2'], description: 'Danh sách ID khách hàng đã có' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  guestIds?: string[];
}
