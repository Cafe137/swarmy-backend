import { Injectable } from '@nestjs/common';
import { Dates, System } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import {
  FileReferencesRow,
  getFileReferencesRows,
  getOnlyOrganizationsRowOrThrow,
  updateFileReferencesRow,
} from '../../DatabaseExtra';
import { AlertService } from '../alert/alert.service';
import { BeeService } from '../bee/bee.service';
import { GlacierService } from './glacier.service';
import { ThumbnailService } from './thumbnail.service';

@Injectable()
export class UploadToBeeQueueScheduledService {
  constructor(
    @InjectPinoLogger(UploadToBeeQueueScheduledService.name)
    private readonly logger: PinoLogger,
    private beeService: BeeService,
    private thumbnailService: ThumbnailService,
    private alertService: AlertService,
    private glacierService: GlacierService,
  ) {
    this.runLoop();
  }

  runLoop() {
    System.forever(
      async () => {
        await this.uploadFiles();
      },
      Dates.seconds(3),
      (m, e) => {
        this.logger.error(e, m);
      },
    );
  }

  async uploadFiles() {
    const files = await getFileReferencesRows({ uploaded: 0 });
    for (const file of files) {
      await this.runUploadJob(file);
      await this.archiveFile(file);
      await rm(file.pathOnDisk);
      await updateFileReferencesRow(file.id, { uploaded: 1 });
    }
  }

  private async runUploadJob(file: FileReferencesRow) {
    const organization = await getOnlyOrganizationsRowOrThrow({ id: file.organizationId });
    const data = createReadStream(file.pathOnDisk);
    const thumbnail = await this.thumbnailService.safeCreateThumbnail(file, data);
    const uploadResult = await this.beeService.upload(
      organization.beeId,
      organization.postageBatchId!,
      data,
      file.name,
      file.contentType,
      file.isWebsite === 1,
    );
    await updateFileReferencesRow(file.id, {
      hash: uploadResult.reference.toHex(),
      uploaded: 1,
      thumbnailBase64: thumbnail,
    });
  }

  private async archiveFile(file: FileReferencesRow) {
    const data = createReadStream(file.pathOnDisk);
    const description = `${file.organizationId}-${file.id}`;
    const result = await this.glacierService.upload(data, description);
    await updateFileReferencesRow(file.id, { archiveId: result.archiveId });
  }
}
