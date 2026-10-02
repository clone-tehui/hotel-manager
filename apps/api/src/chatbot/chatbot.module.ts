import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { ApiKeyGuard } from '../api-keys/api-key.guard';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { CustomerContextService } from './customer-context.service';
import { ChatbotIdempotencyService } from './chatbot-idempotency.service';
import { ReservationsModule } from '../reservations/reservations.module';

@Module({ imports: [PricingModule, ReservationsModule], controllers: [ChatbotController], providers: [ApiKeyGuard, ChatbotService, CustomerContextService, ChatbotIdempotencyService] })
export class ChatbotModule {}
