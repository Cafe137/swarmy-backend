import { BadRequestException, Injectable } from '@nestjs/common';
import { Strings } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { rm, writeFile } from 'node:fs/promises';
import { insertUploadToBeeQueueRow, OrganizationsRow } from 'src/DatabaseExtra';
import { AlertService } from '../alert/alert.service';
import { BeeService } from '../bee/bee.service';
import { UsageMetricsService } from '../usage-metrics/usage-metrics.service';
import { FileReferenceService } from './file.service';
import { UploadResultDto } from './upload.result.dto';

const BEE_MIN_CHUNK_SIZE = 8192; // chunk + metadata 4K each

@Injectable()
export class UploadService {
  constructor(
    @InjectPinoLogger(UploadService.name)
    private readonly logger: PinoLogger,
    private usageMetricsService: UsageMetricsService,
    private fileReferenceService: FileReferenceService,
    private beeService: BeeService,
    private alertService: AlertService,
  ) {}

  async uploadFile(
    organization: OrganizationsRow,
    file: Express.Multer.File,
    uploadAsWebsite?: boolean,
  ): Promise<UploadResultDto> {
    if (!organization.postageBatchId) {
      this.logger.info(`Upload attempted org ${organization.id} that doesn't have a postage batch`);
      await rm(file.path);
      throw new BadRequestException();
    }
    await this.verifyPostageBatch(organization);
    if (uploadAsWebsite) {
      if (!['application/x-tar', 'application/octet-stream'].includes(file.mimetype)) {
        await rm(file.path);
        throw new BadRequestException('Not a .tar file');
      }
    }
    const size = this.roundUp(file.size, BEE_MIN_CHUNK_SIZE);
    await this.usageMetricsService.incrementOrFail(organization.id, 'up', size);

    const fileRef = await this.fileReferenceService.createFileReference(
      organization,
      file.size,
      file.originalname,
      file.mimetype.split(';')[0],
      uploadAsWebsite ?? false,
    );

    await insertUploadToBeeQueueRow({ fileReferenceId: fileRef.id, pathOnDisk: file.path });
    return { id: fileRef.id };
  }

  async uploadData(
    organization: OrganizationsRow,
    name: string,
    contentType: string,
    data: Uint8Array,
  ): Promise<UploadResultDto> {
    if (!organization.postageBatchId) {
      this.logger.info(`Upload attempted org ${organization.id} that doesn't have a postage batch`);
      throw new BadRequestException();
    }
    await this.verifyPostageBatch(organization);
    const size = this.roundUp(data.byteLength, BEE_MIN_CHUNK_SIZE);
    await this.usageMetricsService.incrementOrFail(organization.id, 'up', size);

    const fileRef = await this.fileReferenceService.createFileReference(
      organization,
      data.byteLength,
      name,
      contentType,
      false,
    );

    const tempName = Strings.randomHex(32);
    await writeFile(tempName, data);

    await insertUploadToBeeQueueRow({ fileReferenceId: fileRef.id, pathOnDisk: tempName });
    return { id: fileRef.id };
  }

  private async verifyPostageBatch(organization: OrganizationsRow) {
    if (!organization.postageBatchId) {
      const message = `Upload attempted org ${organization.id} that doesn't have a postage batch`;
      this.logger.error(message);
      this.alertService.sendAlert(message);
      throw new BadRequestException();
    }
    try {
      await this.beeService.getPostageBatch(organization.beeId, organization.postageBatchId);
    } catch (e) {
      const message = `Upload attempted by org: ${organization.id} with postage batch ${organization.postageBatchId} that doesn't exist on bee`;
      this.alertService.sendAlert(message, e);
      this.logger.error(e, message);
      throw new BadRequestException();
    }
  }

  roundUp(numToRound: number, multiple: number) {
    if (multiple === 0) return numToRound;

    const remainder = numToRound % multiple;
    if (remainder === 0) return numToRound;

    return numToRound + multiple - remainder;
  }
}
