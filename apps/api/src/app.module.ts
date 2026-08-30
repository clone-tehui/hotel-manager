import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { RoomTypesModule } from './room-types/room-types.module';
import { RoomsModule } from './rooms/rooms.module';
import { GuestsModule } from './guests/guests.module';
import { ReservationsModule } from './reservations/reservations.module';
import { TimelineModule } from './timeline/timeline.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { BuildingsModule } from './buildings/buildings.module';
import { UsersModule } from './users/users.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AddonsModule } from './addons/addons.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    HealthModule,
    BuildingsModule,
    RoomTypesModule,
    RoomsModule,
    GuestsModule,
    ReservationsModule,
    TimelineModule,
    WebhooksModule,
    UsersModule,
    ApiKeysModule,
    DashboardModule,
    AddonsModule,
  ],
})
export class AppModule {}
