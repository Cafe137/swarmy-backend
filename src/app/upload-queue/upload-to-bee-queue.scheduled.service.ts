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
} from 'src/database/Schema';
import { AlertService } from '../alert/alert.service';
import { BeeService } from '../bee/bee.service';
import { GlacierService } from './glacier.service';

@Injectable()
export class UploadToBeeQueueScheduledService {
  constructor(
    @InjectPinoLogger(UploadToBeeQueueScheduledService.name)
    private readonly logger: PinoLogger,
    private beeService: BeeService,
    private glacierService: GlacierService,
    private alertService: AlertService,
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
      await updateFileReferencesRow(file.id, { uploaded: 1 });
      await rm(file.pathOnDisk);
    }
  }

  private async runUploadJob(file: FileReferencesRow) {
    const organization = await getOnlyOrganizationsRowOrThrow({ id: file.organizationId });
    const reference = await this.beeService.upload(
      organization.beeId,
      organization.postageBatchId!,
      file.pathOnDisk,
      file.name,
      file.contentType,
      file.isWebsite === 1,
    );
    if (reference.toHex() !== file.hash) {
      this.alertService.sendAlert(
        `File hash mismatch for ID ${file.id}, before: ${file.hash}, after: ${reference.toHex()}`,
      );
    }
    await updateFileReferencesRow(file.id, {
      hash: reference.toHex(),
      uploaded: 1,
    });
  }

  private async archiveFile(file: FileReferencesRow) {
    const data = createReadStream(file.pathOnDisk);
    const description = `${file.organizationId}-${file.id}`;
    const result = await this.glacierService.upload(data, description);
    await updateFileReferencesRow(file.id, { archiveId: result.archiveId });
  }
}
