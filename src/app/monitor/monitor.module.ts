import { Module } from '@nestjs/common';
import { AlertModule } from '../alert/alert.module';
import { BeeModule } from '../bee/bee.module';
import { OrganizationModule } from '../organization/organization.module';
import { PlanModule } from '../plan/plan.module';
import { ExpirationMonitorScheduledService } from './expiration-monitor.scheduled.service';
import { WalletMonitorScheduledService } from './wallet-monitor.scheduled.service';

@Module({
  imports: [BeeModule, PlanModule, OrganizationModule, AlertModule],
  providers: [ExpirationMonitorScheduledService, WalletMonitorScheduledService],
})
export class MonitorModule {}
