import { BadRequestException, Injectable } from '@nestjs/common';
import { MerkleTree, Strings } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { createReadStream } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { OrganizationsRow } from 'src/DatabaseExtra';
import { UsageMetricsService } from '../usage-metrics/usage-metrics.service';
import { createManifestWrapper } from '../utility/utility';
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

    if (uploadAsWebsite) {
      if (!['application/x-tar', 'application/octet-stream'].includes(file.mimetype)) {
        await rm(file.path);
        throw new BadRequestException('Not a .tar file');
      }
    }

    const readStream = createReadStream(file.path);
    const tree = new MerkleTree(MerkleTree.NOOP);
    for await (const chunk of readStream) {
      tree.append(chunk);
    }
    const rootHash = await tree.finalize();

    const contentType = file.mimetype.split(';')[0];

    const manifest = createManifestWrapper(file.originalname, contentType, rootHash.hash());
    const swarmReference = (await manifest.calculateSelfAddress()).toHex();

    const size = this.roundUp(file.size, BEE_MIN_CHUNK_SIZE);
    await this.usageMetricsService.incrementOrFail(organization.id, 'up', size);

    const fileRef = await this.fileReferenceService.createFileReference(
      organization,
      file.size,
      file.originalname,
      contentType,
      uploadAsWebsite ?? false,
      swarmReference,
      file.path,
    );

    return { id: fileRef.id, swarmReference };
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
    const size = this.roundUp(data.byteLength, BEE_MIN_CHUNK_SIZE);
    await this.usageMetricsService.incrementOrFail(organization.id, 'up', size);

    const rootHash = await MerkleTree.root(data);

    const manifest = createManifestWrapper(name, contentType, rootHash.hash());
    const swarmReference = (await manifest.calculateSelfAddress()).toHex();

    const tempName = Strings.randomHex(32);
    await writeFile(tempName, data);

    const fileRef = await this.fileReferenceService.createFileReference(
      organization,
      data.byteLength,
      name,
      contentType,
      false,
      (await manifest.calculateSelfAddress()).toHex(),
      tempName,
    );

    return { id: fileRef.id, swarmReference };
  }

  roundUp(numToRound: number, multiple: number) {
    if (multiple === 0) return numToRound;

    const remainder = numToRound % multiple;
    if (remainder === 0) return numToRound;

    return numToRound + multiple - remainder;
  }
}
