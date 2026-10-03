import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsISO8601, IsString } from 'class-validator';
import { ApiKeyGuard } from '../api-keys/api-key.guard';
import { ApiKeyScope } from '../api-keys/api-key-scope.decorator';
import { HousekeepingSyncService } from './housekeeping-sync.service';

class CleaningApprovedDto {
  @IsString() taskId!: string;
  @IsString() taskCode!: string;
  @IsISO8601() approvedAt!: string;
}

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

  @Post('rooms/:roomId/cleaning-approved')
  @ApiKeyScope('housekeeping:rooms:write')
  cleaningApproved(@Param('roomId') roomId: string, @Body() dto: CleaningApprovedDto) {
    return this.service.cleaningApproved(roomId, dto);
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
