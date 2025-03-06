import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Dates } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as fs from 'node:fs';
import { runQuery } from '../../Database';
import {
  getOnlyFileReferencesRowOrThrow,
  getOnlyOrganizationsRowOrThrow,
  getUploadToBeeQueueRows,
  insertUploadToColdStorageQueueRow,
  updateFileReferencesRow,
  UploadToBeeQueueRow,
  UploadToBeeQueueRowId,
} from '../../DatabaseExtra';
import { AlertService } from '../alert/alert.service';
import { BeeHiveService } from '../bee/bee-hive.service';
import { BeeService } from '../bee/bee.service';
import { ThumbnailService } from './thumbnail.service';

@Injectable()
export class UploadToBeeQueueScheduledService {
  constructor(
    @InjectPinoLogger(UploadToBeeQueueScheduledService.name)
    private readonly logger: PinoLogger,
    private beeService: BeeService,
    private beeHive: BeeHiveService,
    private thumbnailService: ThumbnailService,
    private alertService: AlertService,
  ) {}

  private runningJobIds: UploadToBeeQueueRowId[] = [];

  @Interval(Dates.seconds(5))
  private async uploadFiles() {
    const uploadJobs = await getUploadToBeeQueueRows();
    for (const uploadJob of uploadJobs) {
      this.maybeStartUploadJob(uploadJob);
    }
  }

  private async maybeStartUploadJob(uploadJob: UploadToBeeQueueRow) {
    if (this.runningJobIds.includes(uploadJob.id)) {
      this.logger.debug(`Upload job (id: ${uploadJob.id}) is already running`);
      return;
    }
    this.runningJobIds.push(uploadJob.id);
    try {
      this.logger.debug(`Upload job (id: ${uploadJob.id}) is starting. Job id: `);
      await this.startUploadJob(uploadJob);
    } catch (e) {
      this.logger.error(e, `Upload job (id: ${uploadJob.id}) failed.`);
      // todo consider adding max retries
    } finally {
      this.runningJobIds = this.runningJobIds.filter((id) => id !== uploadJob.id);
    }
  }

  private async startUploadJob(uploadJob: UploadToBeeQueueRow) {
    const file = await getOnlyFileReferencesRowOrThrow({ id: uploadJob.fileReferenceId });
    const org = await getOnlyOrganizationsRowOrThrow({ id: file.organizationId });
    const bee = await this.beeHive.getBeeById(org.beeId!);
    if (bee.isUploading) {
      this.logger.debug(`bee busy with ${bee.beeRow.id}. Can't continue upload job (id: ${uploadJob.id})`);
      return;
    }
    this.logger.debug(`Uploading file to bee (id: ${uploadJob.id})`);

    bee.isUploading = true;
    try {
      const data = fs.createReadStream(uploadJob.pathOnDisk);
      const thumbnail = await this.thumbnailService.safeCreateThumbnail(file, data);
      const uploadResult = await this.beeService.upload(
        org.beeId!,
        org.postageBatchId!,
        data,
        file.name,
        file.isWebsite === 1,
      );
      await updateFileReferencesRow(file.id, {
        hash: uploadResult.reference.toHex(),
        uploaded: 1,
        thumbnailBase64: thumbnail,
      });
    } catch (e) {
      this.logger.error(e, `Upload failed for file ${file.id}`);
      this.alertService.sendAlert(`Upload failed for file ${file.id}`, e);
      return;
    } finally {
      bee.isUploading = false;
    }

    await runQuery('DELETE FROM uploadToBeeQueue WHERE id = ?', uploadJob.id);
    await insertUploadToColdStorageQueueRow({ fileReferenceId: file.id, pathOnDisk: uploadJob.pathOnDisk });
    this.logger.debug(`uploading done ${uploadJob.id}`);
  }
}
