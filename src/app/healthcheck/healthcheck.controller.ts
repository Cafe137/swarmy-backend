import { Controller, Get } from '@nestjs/common';
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
}
