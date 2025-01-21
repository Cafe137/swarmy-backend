import { Module } from '@nestjs/common';
import { AlertModule } from '../alert/alert.module';
import { BeeModule } from '../bee/bee.module';
import { OrganizationModule } from '../organization/organization.module';
import { UploadToBeeQueueScheduledService } from './upload-to-bee-queue.scheduled.service';
import { DataModule } from '../data/data.module';
import { GlacierService } from './glacier.service';
import { ThumbnailService } from './thumbnail.service';
import { UploadToColdStorageQueueScheduledService } from './upload-to-cold-storage-queue.scheduled.service';

@Module({
  imports: [AlertModule, DataModule, BeeModule, OrganizationModule],
  controllers: [],
  providers: [
    UploadToBeeQueueScheduledService,
    UploadToColdStorageQueueScheduledService,
    GlacierService,
    ThumbnailService,
  ],
  exports: [],
})
export class UploadQueueModule {}
