import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Interval } from '@nestjs/schedule';
import { getBeesRows } from '../../DatabaseExtra';
import { BeeNode } from './bee-node';
import { Dates } from 'cafe-utility';

@Injectable()
export class BeeHiveService {
  private beeNodes: BeeNode[] = [];

  constructor(
    @InjectPinoLogger(BeeHiveService.name)
    private readonly logger: PinoLogger,
  ) {
    this.refreshBees();
  }

  public getBeeNodes(): BeeNode[] {
    return this.beeNodes;
  }

  @Interval(Dates.seconds(120))
  private async refreshBees() {
    const beeRows = await getBeesRows({ enabled: 1 });

    const newBees: BeeNode[] = [];
    beeRows.forEach((row) => {
      newBees.push(new BeeNode(row, this.logger));
    });
    this.logger.debug(`Refreshing bees completed. There are ${beeRows.length} bees in the hive.`);
    this.beeNodes = newBees;
  }

  public getBeeForDownload(): BeeNode {
    let bees = this.beeNodes.filter((node) => node.beeRow.downloadEnabled && !node.isUploading);
    if (bees.length === 0) {
      bees = this.beeNodes.filter((node) => node.beeRow.downloadEnabled);
    }
    const bee = this.minBy(bees, (b) => b.downloads);
    bee.downloads++;

    return bee;
  }

  async getBeeForPostageBatchCreation() {
    const bees = this.beeNodes.filter((node) => node.beeRow.uploadEnabled);
    if (bees.length === 0) {
      throw new Error('No bees found for postage batch creation.');
    }
    return bees[0];
  }

  async getBeeById(beeId: number) {
    const bee = this.beeNodes.find((beeNode) => beeNode.beeRow.id === beeId);
    if (!bee) {
      throw new Error(`Bee not found by id: ${beeId}`);
    }
    return bee;
  }

  getFirstBee() {
    if (this.beeNodes.length === 0) {
      throw new Error(`No bees found. Can't return first one.`);
    }
    return this.beeNodes[0];
  }

  private minBy(n, e) {
    return n.reduce((t, r) => (e(t) > e(r) ? t : r));
  }
}
