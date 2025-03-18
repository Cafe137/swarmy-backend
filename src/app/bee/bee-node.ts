import { BatchId, Bee, Bytes, FileData } from '@ethersphere/bee-js';
import { PinoLogger } from 'nestjs-pino';
import { Readable } from 'stream';
import { BeesRow } from '../../DatabaseExtra';

export class BeeNode {
  constructor(beeRow: BeesRow, logger: PinoLogger) {
    this.beeRow = beeRow;
    this.logger = logger;
    this.bee = new Bee(beeRow.url, beeRow.secret ? { headers: { authorization: beeRow.secret } } : {});
  }

  beeRow: BeesRow;
  bee: Bee;
  downloads: number = 0;
  isUploading: boolean = false;
  private logger: PinoLogger;

  async download(hash: string, path?: string): Promise<FileData<Bytes>> {
    return this.bee.downloadFile(hash, path);
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
    return this.bee.getAllPostageBatch();
  }

  async getWallet() {
    return this.bee.getWalletBalance();
  }

  async getWalletBzzBalance() {
    const wallet = await this.getWallet();
    return wallet.bzzBalance;
  }

  async getPostageBatch(postageBatchId: string) {
    return this.bee.getPostageBatch(postageBatchId);
  }

  async createPostageBatch(amount: string, depth: number): Promise<BatchId> {
    return this.bee.createPostageBatch(amount, depth, { waitForUsable: true, waitForUsableTimeout: 480_000 });
  }

  async dilute(postageBatchId: string, depth: number) {
    this.logger.info(`Performing dilute on ${postageBatchId} with depth: ${depth}`);
    return this.bee.diluteBatch(postageBatchId, depth);
  }

  async topUp(postageBatchId: string, amount: string) {
    return this.bee.topUpBatch(postageBatchId, amount);
  }

  async getDataPricePerBlock() {
    const chainState = await this.bee.getChainState();
    return chainState.currentPrice;
  }

  async getTopology() {
    return this.bee.getTopology();
  }
}
