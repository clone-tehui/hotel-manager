import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationActionsService } from './reservation-actions.service';
import { ReservationsController } from './reservations.controller';

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationActionsService],
  exports: [ReservationsService, ReservationActionsService],
})
export class ReservationsModule {}
