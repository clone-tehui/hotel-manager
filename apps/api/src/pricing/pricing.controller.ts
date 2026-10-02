import { Body, Controller, Post, UseGuards, UseFilters } from '@nestjs/common';
import { PricingExceptionFilter } from './pricing-exception.filter';
import { ApiKeyGuard } from '../api-keys/api-key.guard';
import { ApiKeyScope } from '../api-keys/api-key-scope.decorator';
import { PriceCheckDto } from './price-check.dto';
import { PricingService } from './pricing.service';

@Controller('pricing')
@UseFilters(PricingExceptionFilter)
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post('price-check')
  @UseGuards(ApiKeyGuard)
  @ApiKeyScope('chatbot:pricing:read')
  check(@Body() input: PriceCheckDto) {
    return this.pricing.check(input);
  }
}
