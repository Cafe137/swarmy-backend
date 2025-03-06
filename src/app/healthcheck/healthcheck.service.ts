import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { BZZ, Topology } from '@upcoming/bee-js';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
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
    if (topology.depth < 7 || topology.depth > 17) {
      const message = `Depth not in range [7, 17]: ${topology.depth}`;
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
}
