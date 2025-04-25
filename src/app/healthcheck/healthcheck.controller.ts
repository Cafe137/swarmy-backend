import { Controller, Get } from '@nestjs/common';
import { Cache, Dates } from 'cafe-utility';
import { Public } from '../auth/public.decorator';
import { HealthcheckService } from './healthcheck.service';

@Controller()
export class HealthcheckController {
  constructor(private healthcheckService: HealthcheckService) {}

  @Public()
  @Get('/healthcheck')
  async healthcheck() {
    await this.healthcheckService.check();
    return { status: 'OK' };
  }

  @Public()
  @Get('/stats')
  async getStats() {
    return Cache.get('stats', Dates.minutes(5), async () => this.healthcheckService.getStats());
  }
}
