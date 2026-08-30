import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token nhận được lúc login' })
  @IsString()
  @MinLength(10)
  refresh_token: string;
}
