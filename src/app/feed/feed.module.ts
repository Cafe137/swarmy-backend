import { Module } from '@nestjs/common';
import { BeeModule } from '../bee/bee.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [BeeModule],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [],
})
export class CryptoPaymentModule {}
