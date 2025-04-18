import { BatchId, Bee, Bytes, FileData, MerkleTree } from '@ethersphere/bee-js';
import { createReadStream } from 'fs';
import { PinoLogger } from 'nestjs-pino';
import { BeesRow } from 'src/database/Schema';
import { uploadTar } from '../utility/tar';
import { createManifestWrapper } from '../utility/utility';

export class BeeNode {
  constructor(beeRow: BeesRow, logger: PinoLogger) {
    this.beeRow = beeRow;
    this.logger = logger;
    this.bee = new Bee(beeRow.url, beeRow.secret ? { headers: { authorization: beeRow.secret } } : {});
  }

  beeRow: BeesRow;
  bee: Bee;
  downloads: number = 0;
  private logger: PinoLogger;

  async download(hash: string, path?: string): Promise<FileData<Bytes>> {
    return this.bee.downloadFile(hash, path);
  }

  async getPublicDataViaBzz(hash: string, path?: string) {
    return this.bee.downloadFile(hash, path);
  }

  async getPublicDataViaBytes(hash: string) {
    return this.bee.downloadData(hash);
  }

  async upload(postageBatchId: string, path: string, fileName: string, contentType: string, uploadAsWebsite?: boolean) {
    if (uploadAsWebsite) {
      return await uploadTar(this.bee, postageBatchId, path);
    } else {
      const readable = createReadStream(path);
      const merkleTree = new MerkleTree(async (chunk) => {
        await this.bee.uploadChunk(postageBatchId, chunk.build());
      });
      for await (const data of readable) {
        await merkleTree.append(data);
      }
      const result = await merkleTree.finalize();
      const manifest = createManifestWrapper(fileName, contentType, result.hash());
      return (await manifest.saveRecursively(this.bee, postageBatchId)).reference;
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
