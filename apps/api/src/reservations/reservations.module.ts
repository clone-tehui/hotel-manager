import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationActionsService } from './reservation-actions.service';
import { PublicAvailabilityController, ReservationsController } from './reservations.controller';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [ReservationsController, PublicAvailabilityController],
  providers: [ReservationsService, ReservationActionsService],
  exports: [ReservationsService, ReservationActionsService],
})
export class ReservationsModule {}
