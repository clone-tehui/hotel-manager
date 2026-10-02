import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { IdType } from '@prisma/client';
import { PriceCheckDto } from '../pricing/price-check.dto';

export class CustomerContextDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(128) guestId?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(32) phone?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(320) email?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(128) idNumber?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(128) reservationCode?: string;
}

export class CreateHoldDto extends PriceCheckDto {
  @IsOptional() @IsString() @MaxLength(128) customerRef?: string;
  @IsOptional() @IsString() @MaxLength(128) conversationRef?: string;
  @IsOptional() @IsString() @MaxLength(64) channelType?: string;
  @IsOptional() @IsString() @MaxLength(128) externalThreadId?: string;
}

export class BookingGuestDto {
  @IsString() @IsNotEmpty() @MaxLength(200) fullName: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(32) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(320) email?: string;
  @IsOptional() @IsEnum(IdType) idType?: IdType;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(128) idNumber?: string;
  @IsOptional() @IsString() @MaxLength(128) nationality?: string;
}

export class BookingFromHoldDto {
  @IsString() @IsNotEmpty() @MaxLength(128) holdId: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(128) guestId?: string;
  @IsOptional() @ValidateNested() @Type(() => BookingGuestDto) guest?: BookingGuestDto;
  @IsOptional() @IsInt() @Min(1) @Max(100) adults?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) children?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
