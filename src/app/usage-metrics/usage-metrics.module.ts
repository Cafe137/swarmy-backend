import { Module } from '@nestjs/common';
import { UsageMetricsService } from '../usage-metrics/usage-metrics.service';
import { UsageMetricsController } from './usage-metrics.controller';
import { UsageMetricsScheduledService } from './usage-metrics.scheduled.service';

@Module({
  controllers: [UsageMetricsController],
  providers: [UsageMetricsService, UsageMetricsScheduledService],
  exports: [UsageMetricsService],
  imports: [],
})
export class UsageMetricsModule {}
