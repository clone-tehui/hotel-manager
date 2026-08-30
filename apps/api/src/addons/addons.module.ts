import { Module } from '@nestjs/common';
import { AddonsController, PublicAddonsController, SepayWebhookController } from './addons.controller';
import { AddonsService } from './addons.service';

@Module({
  controllers: [AddonsController, PublicAddonsController, SepayWebhookController],
  providers: [AddonsService],
})
export class AddonsModule {}
