import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { StayDiscountRulesController } from './stay-discount-rules.controller';
import { StayDiscountRulesService } from './stay-discount-rules.service';
import { ApiKeyGuard } from '../api-keys/api-key.guard';
import { InventoryLockService } from './inventory-lock.service';

@Module({
  controllers: [PricingController, StayDiscountRulesController],
  providers: [PricingService, StayDiscountRulesService, ApiKeyGuard, InventoryLockService],
  exports: [PricingService, InventoryLockService],
})
export class PricingModule {}
