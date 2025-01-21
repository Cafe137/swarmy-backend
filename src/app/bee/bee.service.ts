import { BatchId, Bee, BeeModes, Data, FileData, NULL_TOPIC, Reference } from '@ethersphere/bee-js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Binary, Elliptic, Types } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Readable } from 'stream';
import { BZZ } from '../token/bzz';

@Injectable()
export class BeeService {
  private bee: Bee;

  constructor(
    @InjectPinoLogger(BeeService.name)
    private readonly logger: PinoLogger,
    configService: ConfigService,
  ) {
    this.bee = new Bee(Types.asString(configService.get<string>('BEE_URL'), { name: 'BEE_URL' }));
  }

  async download(hash: string, path?: string): Promise<FileData<Data>> {
    return await this.bee.downloadFile(hash, path);
  }

  async upload(postageBatchId: string, data: Readable, fileName: string, uploadAsWebsite?: boolean) {
    const requestOptions = uploadAsWebsite
      ? {
          headers: {
            'Swarm-Index-Document': 'index.html',
            'Swarm-Collection': 'true',
          },
        }
      : undefined;
    const options = uploadAsWebsite ? { contentType: 'application/x-tar' } : undefined;
    return await this.bee.uploadFile(postageBatchId, data, fileName, options, requestOptions);
  }

  async getAllPostageBatches() {
    return await this.bee.getAllPostageBatch();
  }

  async getWallet() {
    return await this.bee.getWalletBalance();
  }

  async getWalletBzzBalance() {
    if (await this.isDev()) {
      return 99999999;
    }
    const wallet = await this.getWallet();
    return new BZZ(wallet.bzzBalance).toBZZ(2);
  }

  async getPostageBatch(postageBatchId: string) {
    return await this.bee.getPostageBatch(postageBatchId);
  }

  async createPostageBatch(amount: string, depth: number): Promise<BatchId> {
    return await this.bee.createPostageBatch(amount, depth, { waitForUsable: true, waitForUsableTimeout: 480_000 });
  }

  async dilute(postageBatchId: string, depth: number) {
    this.logger.info(`Performing dilute on ${postageBatchId} with depth: ${depth}`);
    if (await this.isDev()) {
      this.logger.info(`Skipping dilute because bee is running in dev mode`);
    } else {
      return await this.bee.diluteBatch(postageBatchId, depth);
    }
  }

  async topUp(postageBatchId: string, amount: string) {
    if (await this.isDev()) {
      this.logger.info(`Skipping topUp because bee is running in dev mode`);
    } else {
      return await this.bee.topUpBatch(postageBatchId, amount);
    }
  }

  async getAmountPerDay() {
    const chainState = await this.bee.getChainState();
    const pricePer5Seconds = Number(chainState.currentPrice);
    return pricePer5Seconds * 12 * 60 * 24;
  }

  async getTopology() {
    return this.bee.getTopology();
  }

  async isDev() {
    const info = await this.bee.getNodeInfo();
    return info.beeMode === BeeModes.DEV;
  }

  async updateFeed(
    postageBatchId: string,
    privateKey: Uint8Array,
    fileReference: string,
  ): Promise<{ reference: string; manifest: string }> {
    const address = Elliptic.publicKeyToAddress(
      Elliptic.privateKeyToPublicKey(Binary.uint256ToNumber(privateKey, 'BE')),
    );
    const writer = this.bee.makeFeedWriter('sequence', NULL_TOPIC, privateKey);
    const { reference: manifest } = await this.bee.createFeedManifest(postageBatchId, 'sequence', NULL_TOPIC, address);
    const { reference } = await writer.upload(postageBatchId, fileReference as Reference);

    return { reference, manifest };
  }
}
