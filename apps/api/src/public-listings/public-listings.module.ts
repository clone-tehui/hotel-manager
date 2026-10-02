import { Module } from '@nestjs/common';
import { PublicListingsController } from './public-listings.controller';

@Module({ controllers: [PublicListingsController] })
export class PublicListingsModule {}
