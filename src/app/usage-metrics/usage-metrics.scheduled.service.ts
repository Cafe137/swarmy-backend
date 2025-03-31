import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Dates } from 'cafe-utility';
import { getUsageMetricsRows, updateUsageMetricsRow } from 'src/database/Schema';

@Injectable()
export class UsageMetricsScheduledService {
  @Interval(Dates.hours(1))
  async checkUsageMetricsForRollover() {
    const usageMetrics = await getUsageMetricsRows({ type: 'DOWNLOADED_BYTES' });
    for (const usageMetric of usageMetrics) {
      if (usageMetric.periodEndsAt.getTime() < Date.now()) {
        await updateUsageMetricsRow(usageMetric.id, { periodEndsAt: new Date(Date.now() + Dates.days(30)), used: 0 });
      }
    }
  }
}
