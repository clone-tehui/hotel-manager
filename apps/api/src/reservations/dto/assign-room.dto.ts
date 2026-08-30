import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRoomDto {
  @ApiProperty({ example: 'room-cuid-here', description: 'ID phòng cần gán' })
  @IsString()
  roomId: string;
}
