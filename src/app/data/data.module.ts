import { Module } from '@nestjs/common';
import { AlertModule } from '../alert/alert.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { BeeModule } from '../bee/bee.module';
import { OrganizationModule } from '../organization/organization.module';
import { PlanModule } from '../plan/plan.module';
import { UsageMetricsModule } from '../usage-metrics/usage-metrics.module';
import { DataController } from './data.controller';
import { DownloadService } from './download.service';
import { FileReferenceService } from './file.service';
import { UploadService } from './upload.service';

@Module({
  imports: [AlertModule, ApiKeyModule, BeeModule, OrganizationModule, PlanModule, UsageMetricsModule],
  controllers: [DataController],
  providers: [UploadService, FileReferenceService, DownloadService],
  exports: [],
})
export class DataModule {}
