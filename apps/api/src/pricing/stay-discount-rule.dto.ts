import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { StayDurationUnit } from '@prisma/client';

export class CreateStayDiscountRuleDto {
  @IsInt() @Min(1) @Max(365000) minValue: number;
  @IsEnum(StayDurationUnit) minUnit: StayDurationUnit;
  @IsOptional() @IsInt() @Min(1) @Max(365000) maxValue?: number | null;
  @IsOptional() @IsEnum(StayDurationUnit) maxUnit?: StayDurationUnit | null;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9999999999.99) discountPerNight: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateStayDiscountRuleDto extends PartialType(CreateStayDiscountRuleDto) {}
