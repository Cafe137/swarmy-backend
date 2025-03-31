import { BatchId, Bytes, BZZ, FileData, NULL_TOPIC, PostageBatch, Reference } from '@ethersphere/bee-js';
import { Injectable } from '@nestjs/common';
import { Binary, Elliptic } from 'cafe-utility';
import { BeesRowId, getOnlyOrganizationsRowOrThrow, OrganizationsRowId } from 'src/database/Schema';
import { BeeHiveService } from './bee-hive.service';
import { BeeNode } from './bee-node';

@Injectable()
export class BeeService {
  constructor(private readonly beeHive: BeeHiveService) {}

  async download(hash: string, path?: string): Promise<FileData<Bytes>> {
    const bee = this.beeHive.getBeeForDownload();
    return bee.download(hash, path);
  }

  async getPublicDataViaBzz(hash: string, path?: string) {
    const bee = this.beeHive.getBeeForDownload();
    return bee.getPublicDataViaBzz(hash, path);
  }

  async getPublicDataViaBytes(hash: string) {
    const bee = this.beeHive.getBeeForDownload();
    return bee.getPublicDataViaBytes(hash);
  }

  async upload(
    beeId: BeesRowId,
    postageBatchId: string,
    data: Buffer,
    fileName: string,
    contentType: string,
    uploadAsWebsite?: boolean,
  ) {
    const bee = await this.beeHive.getBeeById(beeId);
    return bee.upload(postageBatchId, data, fileName, contentType, uploadAsWebsite);
  }

  async getDataPricePerBlock() {
    const bees = this.beeHive.getBeeNodes();
    if (!bees.length) {
      throw Error('No bees available');
    }
    return bees[0].getDataPricePerBlock();
  }

  async getAllPostageBatches() {
    const bees = this.beeHive.getBeeNodes();

    const batches: PostageBatch[] = [];
    for (const bee of bees) {
      const nodeBatches = await bee.getAllPostageBatches();
      batches.push(...nodeBatches);
    }

    return batches;
  }

  async getWalletBzzBalances() {
    const result: { balance: BZZ; beeNode: BeeNode }[] = [];
    const bees = this.beeHive.getBeeNodes();

    for (const beeNode of bees) {
      const balance = await beeNode.getWalletBzzBalance();
      result.push({ balance, beeNode });
    }

    return result;
  }

  async getPostageBatch(beeId: BeesRowId, postageBatchId: string) {
    const bee = await this.beeHive.getBeeById(beeId);
    return bee.getPostageBatch(postageBatchId);
  }

  async createPostageBatch(amount: string, depth: number, beeId: BeesRowId): Promise<{ postageBatchId: BatchId }> {
    const bee = await this.beeHive.getBeeById(beeId);
    const postageBatchId = await bee.createPostageBatch(amount, depth);
    return { postageBatchId };
  }

  async dilute(beeId: BeesRowId, postageBatchId: string, depth: number) {
    const bee = await this.beeHive.getBeeById(beeId);
    return bee.dilute(postageBatchId, depth);
  }

  async topUp(beeId: BeesRowId, postageBatchId: string, amount: string) {
    const bee = await this.beeHive.getBeeById(beeId);
    return bee.topUp(postageBatchId, amount);
  }

  async getTopology() {
    const bee = this.beeHive.getFirstBee();
    return bee.getTopology();
  }

  async updateFeed(
    organizationId: OrganizationsRowId,
    privateKey: Uint8Array,
    fileReference: string,
  ): Promise<{ reference: Reference; manifest: Reference }> {
    const organization = await getOnlyOrganizationsRowOrThrow({ id: organizationId });
    if (!organization.beeId || !organization.postageBatchId) {
      throw Error('Organization does not have a beeId or postageBatchId');
    }
    const address = Elliptic.publicKeyToAddress(
      Elliptic.privateKeyToPublicKey(Binary.uint256ToNumber(privateKey, 'BE')),
    );
    const { bee } = await this.beeHive.getBeeById(organization.beeId);
    const writer = bee.makeFeedWriter(NULL_TOPIC, privateKey);
    const manifest = await bee.createFeedManifest(organization.postageBatchId, NULL_TOPIC, address);
    const { reference } = await writer.uploadPayload(organization.postageBatchId, fileReference);

    return { reference, manifest };
  }
}
