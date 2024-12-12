import { Controller, Get } from '@nestjs/common';
import { UsersRow } from 'src/DatabaseExtra';
import { UserInContext } from '../user/user.decorator';
import { UsageMetricsService } from './usage-metrics.service';

@Controller()
export class UsageMetricsController {
  constructor(private readonly usageMetricsService: UsageMetricsService) {}

  @Get('/')
  getUsageMetricsForOrganization(@UserInContext() user: UsersRow) {
    return this.usageMetricsService.getAllForOrganization(user.organizationId);
  }
}
