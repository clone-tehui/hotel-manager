import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, UseFilters } from '@nestjs/common';
import { PricingExceptionFilter } from './pricing-exception.filter';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateStayDiscountRuleDto, UpdateStayDiscountRuleDto } from './stay-discount-rule.dto';
import { StayDiscountRulesService } from './stay-discount-rules.service';

@Controller('room-types/:roomTypeId/stay-discount-rules')
@UseFilters(PricingExceptionFilter)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class StayDiscountRulesController {
  constructor(private readonly rules: StayDiscountRulesService) {}

  @Get()
  list(@Param('roomTypeId') roomTypeId: string) { return this.rules.list(roomTypeId); }

  @Post()
  create(@Param('roomTypeId') roomTypeId: string, @Body() input: CreateStayDiscountRuleDto) { return this.rules.save(roomTypeId, input); }

  @Patch(':ruleId')
  update(@Param('roomTypeId') roomTypeId: string, @Param('ruleId') ruleId: string, @Body() input: UpdateStayDiscountRuleDto) { return this.rules.save(roomTypeId, input, ruleId); }

  @Delete(':ruleId')
  remove(@Param('roomTypeId') roomTypeId: string, @Param('ruleId') ruleId: string) { return this.rules.remove(roomTypeId, ruleId); }
}
