import { Controller, Get } from '@nestjs/common';
import { UsersRow } from 'src/database/Schema';
import { UserInContext } from '../user/user.decorator';
import { UsageMetricsService } from './usage-metrics.service';

@Controller()
export class UsageMetricsController {
  constructor(private readonly usageMetricsService: UsageMetricsService) {}

  @Get('/usage-metrics')
  getUsageMetricsForOrganization(@UserInContext() user: UsersRow) {
    return this.usageMetricsService.getAllForOrganization(user.organizationId);
  }
}
