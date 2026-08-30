import { IsString, IsOptional, IsEmail, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GuestGender, IdType } from '@prisma/client';

export class CreateGuestDto {
  @ApiProperty({ example: 'Nguyễn Văn An' })
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ example: 'nguyen@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: GuestGender, example: GuestGender.FEMALE })
  @IsOptional()
  @IsEnum(GuestGender)
  gender?: GuestGender;

  @ApiPropertyOptional({ enum: IdType, default: IdType.NATIONAL_ID })
  @IsOptional()
  @IsEnum(IdType)
  idType?: IdType;

  @ApiPropertyOptional({ example: '079123456789' })
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiPropertyOptional({ example: 'Vietnamese' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({ example: 'Công ty TNHH ABC' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ example: '0123456789' })
  @IsOptional()
  @IsString()
  taxCode?: string;

  @ApiPropertyOptional({ example: '123 Lê Lợi, Q.1, TP.HCM' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'Khách VIP thường xuyên' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;
}
