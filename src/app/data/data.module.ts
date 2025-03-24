import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AlertModule } from '../alert/alert.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { BeeModule } from '../bee/bee.module';
import { BeeService } from '../bee/bee.service';
import { OrganizationModule } from '../organization/organization.module';
import { PlanModule } from '../plan/plan.module';
import { UsageMetricsModule } from '../usage-metrics/usage-metrics.module';
import { DataController } from './data.controller';
import { DownloadService } from './download.service';
import { FileReferenceService } from './file.service';
import { UploadService } from './upload.service';

@Module({
  imports: [
    AlertModule,
    ApiKeyModule,
    BeeModule,
    OrganizationModule,
    PlanModule,
    UsageMetricsModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        storage: diskStorage({
          destination: configService.get<string>('MULTER_DEST'),
          filename: (req, file, cb) => {
            const filename = `${Date.now()}-${file.originalname}`;
            cb(null, filename);
          },
        }),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [DataController],
  providers: [UploadService, FileReferenceService, DownloadService, BeeService],
  exports: [],
})
export class DataModule {}
