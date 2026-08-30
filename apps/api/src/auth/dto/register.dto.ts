import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'staff@hotel.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Staff@123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Nguyễn Văn B' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ enum: ['ADMIN','USER'], default: 'USER' })
  @IsOptional()
  @IsString()
  @IsIn(['ADMIN','USER'])
  role?: 'ADMIN' | 'USER';

}
