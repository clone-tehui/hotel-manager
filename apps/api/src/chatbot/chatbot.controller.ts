import { Body, Controller, Get, Headers, Param, Post, Request, UseGuards, UseFilters } from '@nestjs/common';
import { PricingExceptionFilter } from '../pricing/pricing-exception.filter';
import { ApiKeyGuard } from '../api-keys/api-key.guard';
import { ApiKeyScope } from '../api-keys/api-key-scope.decorator';
import { BookingFromHoldDto, CreateHoldDto, CustomerContextDto } from './chatbot.dto';
import { ChatbotService } from './chatbot.service';
import { CustomerContextService } from './customer-context.service';

@Controller('chatbot')
@UseFilters(PricingExceptionFilter)
@UseGuards(ApiKeyGuard)
export class ChatbotController {
  constructor(private readonly chatbot: ChatbotService, private readonly customers: CustomerContextService) {}

  @Post('customer-context') @ApiKeyScope('chatbot:customer:read')
  context(@Body() input: CustomerContextDto) { return this.customers.context(input); }

  @Post('holds') @ApiKeyScope('chatbot:hold:write')
  create(@Request() request: any, @Headers('idempotency-key') key: string, @Body() input: CreateHoldDto) { return this.chatbot.createHold(request.apiKey.id, key, input); }

  @Get('holds/:id') @ApiKeyScope('chatbot:hold:read')
  hold(@Request() request: any, @Param('id') id: string) { return this.chatbot.getHold(request.apiKey.id, id); }

  @Post('holds/:id/release') @ApiKeyScope('chatbot:hold:write')
  release(@Request() request: any, @Param('id') id: string, @Headers('idempotency-key') key: string) { return this.chatbot.release(request.apiKey.id, key, id); }

  @Post('bookings/from-hold') @ApiKeyScope('chatbot:booking:write')
  book(@Request() request: any, @Headers('idempotency-key') key: string, @Body() input: BookingFromHoldDto) { return this.chatbot.book(request.apiKey.id, key, input); }

  @Get('bookings/:id') @ApiKeyScope('chatbot:booking:read')
  booking(@Request() request: any, @Param('id') id: string) { return this.chatbot.booking(request.apiKey.id, id); }
}
