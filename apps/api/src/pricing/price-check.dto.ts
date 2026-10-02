import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class PriceCheckDto {
  @IsString() @IsNotEmpty() @MaxLength(128) roomId: string;
  @IsString() @IsNotEmpty() @MaxLength(64) checkInDate: string;
  @IsString() @IsNotEmpty() @MaxLength(64) checkOutDate: string;
  @IsOptional() @IsIn(['yes', 'no']) discount?: 'yes' | 'no';
}
