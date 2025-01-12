import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AlertService } from '../alert/alert.service';
import { Dates, System } from 'cafe-utility';
import {
  getOnlyFileReferencesRowOrThrow,
  getUploadToColdStorageQueueRows,
  updateFileReferencesRow,
  UploadToColdStorageQueueRow,
} from '../../DatabaseExtra';
import { runQuery } from '../../Database';
import * as fs from 'node:fs';
import { GlacierService } from './glacier.service';

@Injectable()
export class UploadToColdStorageQueueScheduledService {
  constructor(
    @InjectPinoLogger(UploadToColdStorageQueueScheduledService.name)
    private readonly logger: PinoLogger,
    private glacierService: GlacierService,
    private alertService: AlertService,
  ) {
    this.runLoop();
  }

  runLoop() {
    System.forever(
      async () => {
        await this.archiveFiles();
      },
      Dates.seconds(10),
      (m, e) => {
        this.logger.error(e, m);
      },
    );
  }

  private async archiveFiles() {
    const uploadJobs = await getUploadToColdStorageQueueRows();
    for (const uploadJob of uploadJobs) {
      await this.archiveFile(uploadJob);
    }
  }

  private async archiveFile(uploadJob: UploadToColdStorageQueueRow) {
    const file = await getOnlyFileReferencesRowOrThrow({ id: uploadJob.fileReferenceId });
    this.logger.debug(`Uploading to cold storage. Job id: ${uploadJob.id}`);
    try {
      const data = fs.createReadStream(uploadJob.pathOnDisk);
      const description = `${file.organizationId}-${file.id}`;
      const result = await this.glacierService.upload(data, description);
      await updateFileReferencesRow(file.id, { archiveId: result.archiveId });
      await runQuery('DELETE FROM uploadToColdStorageQueue WHERE id = ?', uploadJob.id);
      fs.rmSync(uploadJob.pathOnDisk);
      this.logger.debug(`Uploading to cold storage done. Job id: ${uploadJob.id}`);
    } catch (e) {
      this.logger.error(e, `Archive job failed. Job id: ${uploadJob.id}`);
      this.alertService.sendAlert(`Archive job failed for file ${file.id}`, e);
    }
  }
}
