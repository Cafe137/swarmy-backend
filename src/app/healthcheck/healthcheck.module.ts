import { Module } from '@nestjs/common';
import { AlertModule } from '../alert/alert.module';
import { BeeModule } from '../bee/bee.module';
import { HealthcheckController } from './healthcheck.controller';
import { HealthcheckService } from './healthcheck.service';

@Module({
  imports: [AlertModule, BeeModule],
  controllers: [HealthcheckController],
  providers: [HealthcheckService],
  exports: [],
})
export class HealthcheckModule {}
