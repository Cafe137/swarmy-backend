import { BadRequestException, Injectable } from '@nestjs/common';
import { MerkleTree, Strings } from 'cafe-utility';
import { createReadStream } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { OrganizationsRow } from 'src/database/Schema';
import { UsageMetricsService } from '../usage-metrics/usage-metrics.service';
import { predictTarRootHash } from '../utility/tar';
import { createManifestWrapper } from '../utility/utility';
import { FileReferenceService } from './file.service';
import { UploadResultDto } from './upload.result.dto';

const ENCODER = new TextEncoder();

@Injectable()
export class UploadService {
  constructor(
    private usageMetricsService: UsageMetricsService,
    private fileReferenceService: FileReferenceService,
  ) {}

  async uploadFile(
    organization: OrganizationsRow,
    file: Express.Multer.File,
    uploadAsWebsite?: boolean,
  ): Promise<UploadResultDto> {
    if (!organization.postageBatchId) {
      await rm(file.path);
      throw new BadRequestException();
    }

    if (uploadAsWebsite) {
      if (!['application/x-tar', 'application/octet-stream'].includes(file.mimetype)) {
        await rm(file.path);
        throw new BadRequestException('Not a .tar file');
      }
      const swarmReference = (await predictTarRootHash(file.path)).toHex();

      await this.usageMetricsService.incrementOrFail(organization.id, 'up', file.size);

      const fileRef = await this.fileReferenceService.createFileReference(
        organization,
        file.size,
        file.originalname,
        file.mimetype,
        true,
        swarmReference,
        file.path,
      );

      return { id: fileRef.id, swarmReference };
    } else {
      const readable = createReadStream(file.path);

      const tree = new MerkleTree(MerkleTree.NOOP);
      for await (const data of readable) {
        await tree.append(data);
      }
      const rootHash = await tree.finalize();

      const contentType = file.mimetype.split(';')[0];

      const manifest = createManifestWrapper(file.originalname, contentType, rootHash.hash());
      const swarmReference = (await manifest.calculateSelfAddress()).toHex();

      await this.usageMetricsService.incrementOrFail(organization.id, 'up', file.size);

      const fileRef = await this.fileReferenceService.createFileReference(
        organization,
        file.size,
        file.originalname,
        contentType,
        false,
        swarmReference,
        file.path,
      );

      return { id: fileRef.id, swarmReference };
    }
  }

  async uploadUtf8Data(
    organization: OrganizationsRow,
    name: string,
    contentType: string,
    utf8: string,
  ): Promise<UploadResultDto> {
    const data = ENCODER.encode(utf8);
    return this.uploadBinaryData(organization, name, contentType, data);
  }

  async uploadBinaryData(
    organization: OrganizationsRow,
    name: string,
    contentType: string,
    data: Uint8Array,
  ): Promise<UploadResultDto> {
    if (!organization.postageBatchId) {
      throw new BadRequestException();
    }

    await this.usageMetricsService.incrementOrFail(organization.id, 'up', data.byteLength);

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
}
