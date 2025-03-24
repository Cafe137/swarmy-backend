import { Module } from '@nestjs/common';
import { AlertModule } from '../alert/alert.module';
import { BeeModule } from '../bee/bee.module';
import { DataModule } from '../data/data.module';
import { OrganizationModule } from '../organization/organization.module';
import { GlacierService } from './glacier.service';
import { UploadToBeeQueueScheduledService } from './upload-to-bee-queue.scheduled.service';

@Module({
  imports: [AlertModule, DataModule, BeeModule, OrganizationModule],
  controllers: [],
  providers: [UploadToBeeQueueScheduledService, GlacierService],
  exports: [],
})
export class UploadQueueModule {}
