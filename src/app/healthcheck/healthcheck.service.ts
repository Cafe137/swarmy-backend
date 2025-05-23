import { BZZ, Topology } from '@ethersphere/bee-js';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { getOnlyRowOrThrow } from 'src/database/Database';
import { AlertService } from '../alert/alert.service';
import { BeeService } from '../bee/bee.service';

@Injectable()
export class HealthcheckService {
  constructor(
    @InjectPinoLogger(HealthcheckService.name)
    private readonly logger: PinoLogger,
    private beeService: BeeService,
    private alertService: AlertService,
  ) {}

  async check() {
    let topology: Topology | null = null;
    try {
      topology = await this.beeService.getTopology();
    } catch {
      const message = 'Failed to get topology';
      this.logger.error(message);
      this.alertService.sendAlert(message);
      throw new InternalServerErrorException(message);
    }
    if (topology.connected < 100) {
      const message = `Less than 100 nodes connected: ${topology.connected}`;
      this.logger.error(message);
      this.alertService.sendAlert(message);
      throw new InternalServerErrorException(message);
    }
    if (topology.depth < 5 || topology.depth > 15) {
      const message = `Depth not in range [5, 15]: ${topology.depth}`;
      this.logger.error(message);
      this.alertService.sendAlert(message);
      throw new InternalServerErrorException(message);
    }
    const balances = await this.beeService.getWalletBzzBalances();

    for (const balanceResult of balances) {
      if (balanceResult.balance.lt(BZZ.fromDecimalString('20.0'))) {
        const message = `Low balance: ${balanceResult.balance} on ${balanceResult.beeNode.beeRow.name}`;
        this.logger.error(message);
        this.alertService.sendAlert(message);
        throw new InternalServerErrorException(message);
      }
    }
  }

  async getStats() {
    const uploadedFiles = await getOnlyRowOrThrow('SELECT COUNT(*) as count FROM fileReferences');
    const downloaded = await getOnlyRowOrThrow('SELECT SUM(size) as sum FROM publicHashes WHERE size IS NOT NULL');
    const latency = await getOnlyRowOrThrow(
      'SELECT AVG(durationMillis) as average FROM publicHashes WHERE durationMillis IS NOT NULL AND size < 1000000',
    );
    const topology = await this.beeService.getTopology();
    const storagePrice = await this.beeService.getDataPricePerBlock();
    const postageBatches = await this.beeService.getGlobalBatchCount();

    return {
      uploadedFiles: uploadedFiles.count,
      downloaded: downloaded.sum,
      latency: latency.average,
      storagePrice,
      postageBatches,
      population: topology.population,
    };
  }
}
