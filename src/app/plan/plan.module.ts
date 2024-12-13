import { Module } from '@nestjs/common';
import { AlertModule } from '../alert/alert.module';
import { BeeModule } from '../bee/bee.module';
import { StripeModule } from '../stripe/stripe.module';
import { UsageMetricsModule } from '../usage-metrics/usage-metrics.module';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';

@Module({
  controllers: [PlanController],
  providers: [PlanService],
  exports: [PlanService],
  imports: [AlertModule, UsageMetricsModule, BeeModule, StripeModule],
})
export class PlanModule {}
