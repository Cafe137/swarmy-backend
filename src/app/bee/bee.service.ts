import { BatchId, Data, FileData, PostageBatch } from '@ethersphere/bee-js';
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { BeeHiveService } from './bee-hive.service';
import { BeesRowId } from '../../DatabaseExtra';
import { BeeNode } from './bee-node';

const AMOUNT_FOR_ONE_DAY = 414720000;

@Injectable()
export class BeeService {
  constructor(private readonly beeHive: BeeHiveService) {}

  async download(hash: string, path?: string): Promise<FileData<Data>> {
    const bee = this.beeHive.getBeeForDownload();
    return bee.download(hash, path);
  }

  async upload(beeId: BeesRowId, postageBatchId: string, data: Readable, fileName: string, uploadAsWebsite?: boolean) {
    const bee = await this.beeHive.getBeeById(beeId);
    return await bee.upload(postageBatchId, data, fileName, uploadAsWebsite);
  }

  async getAllPostageBatches() {
    const bees = this.beeHive.getBeeNodes();

    const batches: PostageBatch[] = [];
    for (const bee of bees) {
      const batches = await bee.getAllPostageBatches();
      batches.push(...batches);
    }

    return batches;
  }

  async getWalletBzzBalances() {
    const result: { balance: number; beeNode: BeeNode }[] = [];
    const bees = this.beeHive.getBeeNodes();

    for (const beeNode of bees) {
      const balance = await beeNode.getWalletBzzBalance();
      result.push({ balance, beeNode });
    }

    return result;
  }

  async getPostageBatch(beeId: BeesRowId, postageBatchId: string) {
    const bee = await this.beeHive.getBeeById(beeId);
    return await bee.getPostageBatch(postageBatchId);
  }

  async createPostageBatch(amount: string, depth: number): Promise<{ postageBatchId: BatchId; beeId: BeesRowId }> {
    const bee = await this.beeHive.getBeeForPostageBatchCreation();
    const postageBatchId = await bee.createPostageBatch(amount, depth);
    return { postageBatchId, beeId: bee.beeRow.id };
  }

  async dilute(beeId: BeesRowId, postageBatchId: string, depth: number) {
    const bee = await this.beeHive.getBeeById(beeId);
    return await bee.dilute(postageBatchId, depth);
  }

  async topUp(beeId: BeesRowId, postageBatchId: string, amount: string) {
    const bee = await this.beeHive.getBeeById(beeId);
    return await bee.topUp(postageBatchId, amount);
  }

  async getAmountPerDay() {
    const bee = this.beeHive.getFirstBee();
    if (await bee.isDev()) {
      return AMOUNT_FOR_ONE_DAY;
    }
    return await bee.getAmountPerDay();
  }

  async getTopology() {
    const bee = this.beeHive.getFirstBee();
    return bee.getTopology();
  }
}
