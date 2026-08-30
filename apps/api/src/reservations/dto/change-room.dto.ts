import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangeRoomDto {
  @ApiProperty({ example: 'room-cuid-here', description: 'ID phòng mới' })
  @IsString()
  newRoomId: string;

  @ApiPropertyOptional({ example: 'Khách yêu cầu phòng tầng cao hơn' })
  @IsOptional()
  @IsString()
  reason?: string;
}
