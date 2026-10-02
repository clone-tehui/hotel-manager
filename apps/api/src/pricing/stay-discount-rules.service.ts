import { Injectable } from '@nestjs/common';
import { StayDurationUnit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { pricingError } from './pricing-error';
import { CreateStayDiscountRuleDto, UpdateStayDiscountRuleDto } from './stay-discount-rule.dto';

const units = { DAY: 1, MONTH: 30, YEAR: 365 };

export function normalizeRule(input: { minValue: number; minUnit: StayDurationUnit; maxValue?: number | null; maxUnit?: StayDurationUnit | null; discountPerNight: unknown; isActive?: boolean }) {
  const minNights = input.minValue * units[input.minUnit];
  const maxNights = input.maxValue == null ? null : input.maxValue * units[input.maxUnit];
  if (!Number.isSafeInteger(minNights) || minNights < 1 || (maxNights != null && (!Number.isSafeInteger(maxNights) || maxNights < minNights)) || (input.maxValue == null && input.maxUnit != null) || input.discountPerNight == null || !Number.isFinite(Number(input.discountPerNight)) || Number(input.discountPerNight) < 0) {
    pricingError('INVALID_DISCOUNT_CONFIGURATION');
  }
  return { minValue: input.minValue, minUnit: input.minUnit, maxValue: input.maxValue ?? null, maxUnit: input.maxValue == null ? null : input.maxUnit, minNights, maxNights, discountPerNight: input.discountPerNight, isActive: input.isActive ?? true };
}

@Injectable()
export class StayDiscountRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(roomTypeId: string) {
    if (!await this.prisma.roomType.findUnique({ where: { id: roomTypeId } })) pricingError('ROOM_TYPE_NOT_FOUND', 404);
    return this.prisma.roomTypeStayDiscountRule.findMany({ where: { roomTypeId }, orderBy: { minNights: 'asc' } });
  }

  async save(roomTypeId: string, input: CreateStayDiscountRuleDto | UpdateStayDiscountRuleDto, ruleId?: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`hotel-room-type-rules:${roomTypeId}`}, 0))::text`;
      if (!await tx.roomType.findUnique({ where: { id: roomTypeId } })) pricingError('ROOM_TYPE_NOT_FOUND', 404);
      const existing = ruleId ? await tx.roomTypeStayDiscountRule.findFirst({ where: { id: ruleId, roomTypeId } }) : null;
      if (ruleId && !existing) pricingError('DISCOUNT_RULE_NOT_FOUND', 404);
      const data = normalizeRule({ ...existing, ...input } as any);
      if (data.isActive) {
        const overlap = await tx.roomTypeStayDiscountRule.findFirst({ where: {
          roomTypeId, isActive: true, ...(ruleId ? { id: { not: ruleId } } : {}),
          ...(data.maxNights != null ? { minNights: { lte: data.maxNights } } : {}),
          OR: [{ maxNights: null }, { maxNights: { gte: data.minNights } }],
        } });
        if (overlap) pricingError('DISCOUNT_RULE_OVERLAP', 409);
      }
      return ruleId
        ? tx.roomTypeStayDiscountRule.update({ where: { id: ruleId }, data: data as any })
        : tx.roomTypeStayDiscountRule.create({ data: { ...data, roomTypeId } as any });
    }, { maxWait: 10000, timeout: 15000 });
  }

  async remove(roomTypeId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`hotel-room-type-rules:${roomTypeId}`}, 0))::text`;
      if (!await tx.roomTypeStayDiscountRule.findFirst({ where: { id, roomTypeId } })) pricingError('DISCOUNT_RULE_NOT_FOUND', 404);
      await tx.roomTypeStayDiscountRule.delete({ where: { id } });
      return { deleted: true };
    });
  }
}
