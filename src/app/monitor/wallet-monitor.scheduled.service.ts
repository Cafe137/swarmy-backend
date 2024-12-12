import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Dates } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AlertService } from '../alert/alert.service';
import { BeeService } from '../bee/bee.service';
import { BZZ } from '../token/bzz';

@Injectable()
export class WalletMonitorScheduledService {
  constructor(
    @InjectPinoLogger(WalletMonitorScheduledService.name)
    private readonly logger: PinoLogger,
    private alertService: AlertService,
    private beeService: BeeService,
  ) {}

  @Interval(Dates.minutes(10))
  async checkPostageBatchTTL() {
    const wallet = await this.beeService.getWallet();
    this.logger.info(`Wallet Monitor - balance is ${new BZZ(wallet.bzzBalance).toString()} BZZ`);
    if (new BZZ(wallet.bzzBalance).toBZZ(1) < 10) {
      this.alertService.sendAlert('Wallet Monitor - balance is below 10 BZZ');
    }
  }
}
