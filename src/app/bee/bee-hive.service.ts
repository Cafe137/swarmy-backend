import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Dates } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { getBeesRows } from 'src/database/Schema';
import { BeeNode } from './bee-node';

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

  @Interval(Dates.minutes(2))
  private async refreshBees() {
    const beeRows = await getBeesRows({ enabled: 1 });
    this.beeNodes = beeRows.map((row) => new BeeNode(row, this.logger));
  }

  public getBeeForDownload(): BeeNode {
    let bees = this.beeNodes.filter((node) => node.beeRow.downloadEnabled);
    if (bees.length === 0) {
      bees = this.beeNodes.filter((node) => node.beeRow.downloadEnabled);
    }
    const bee = this.minBy(bees, (b) => b.downloads);
    bee.downloads++;

    return bee;
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
      throw Error(`No bees found. Can't return first one.`);
    }
    return this.beeNodes[0];
  }

  private minBy<T>(n: T[], e: (x: T) => number): T {
    return n.reduce((t, r) => (e(t) > e(r) ? t : r));
  }
}
