import { Module } from '@nestjs/common';
import { AlertModule } from '../alert/alert.module';
import { BeeModule } from '../bee/bee.module';
import { PostageBatchQueueScheduledService } from './postage-batch-queue.scheduled.service';

@Module({
  providers: [PostageBatchQueueScheduledService],
  imports: [AlertModule, BeeModule],
})
export class PostageBatchQueueModule {}
