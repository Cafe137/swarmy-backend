import { BatchId, Bee, BeeModes, Data, FileData } from '@ethersphere/bee-js';
import { PinoLogger } from 'nestjs-pino';
import { Readable } from 'stream';
import { BeesRow } from '../../DatabaseExtra';
import { BZZ } from '../token/bzz';

export class BeeNode {
  constructor(beeRow: BeesRow, logger: PinoLogger) {
    this.beeRow = beeRow;
    this.logger = logger;
    this.bee = new Bee(beeRow.url);
  }

  beeRow: BeesRow;
  bee: Bee;
  downloads: number = 0;
  isUploading: boolean = false;
  private logger: PinoLogger;

  async download(hash: string, path?: string): Promise<FileData<Data>> {
    return await this.bee.downloadFile(hash, path);
  }

  async upload(postageBatchId: string, data: Readable, fileName: string, uploadAsWebsite?: boolean) {
    try {
      this.isUploading = true;
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
    } catch (e) {
      throw e;
    } finally {
      this.isUploading = false;
    }
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
}
