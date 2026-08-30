import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelReservationDto {
  @ApiProperty({ example: 'Khách yêu cầu huỷ, hoàn tiền 80%' })
  @IsString()
  @MinLength(5, { message: 'Lý do huỷ phải có ít nhất 5 ký tự' })
  cancelReason: string;
}
