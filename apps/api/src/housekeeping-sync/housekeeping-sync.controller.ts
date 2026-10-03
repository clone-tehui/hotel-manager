import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../api-keys/api-key.guard';
import { ApiKeyScope } from '../api-keys/api-key-scope.decorator';
import { HousekeepingSyncService } from './housekeeping-sync.service';

@Controller('housekeeping-sync')
@UseGuards(ApiKeyGuard)
export class HousekeepingSyncController {
  constructor(private readonly service: HousekeepingSyncService) {}

  @Get('snapshot')
  @ApiKeyScope('housekeeping:sync:read')
  snapshot(@Query('updatedSince') updatedSince?: string) {
    return this.service.snapshot(updatedSince);
  }

  @Get('rooms/:roomId')
  @ApiKeyScope('housekeeping:rooms:read')
  room(@Param('roomId') roomId: string) {
    return this.service.room(roomId);
  }

  @Get('reservations/:reservationId')
  @ApiKeyScope('housekeeping:reservations:read')
  reservation(@Param('reservationId') reservationId: string) {
    return this.service.reservation(reservationId);
  }

  @Get('rooms/:roomId/next-turnover')
  @ApiKeyScope('housekeeping:sync:read')
  nextTurnover(@Param('roomId') roomId: string) {
    return this.service.nextTurnover(roomId);
  }

  @Get('health')
  @ApiKeyScope('housekeeping:sync:read')
  health() {
    return this.service.health();
  }
}
