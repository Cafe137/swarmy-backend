import { Injectable } from '@nestjs/common';
import { Dates, System } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { runQuery } from 'src/Database';
import {
  getOnlyOrganizationsRowOrThrow,
  getPostageCreationQueueRows,
  getPostageDiluteQueueRows,
  getPostageTopUpQueueRows,
  updateOrganizationsRow,
} from 'src/DatabaseExtra';
import { AlertService } from '../alert/alert.service';
import { BeeService } from '../bee/bee.service';

@Injectable()
export class PostageBatchQueueScheduledService {
  constructor(
    @InjectPinoLogger(PostageBatchQueueScheduledService.name)
    private readonly logger: PinoLogger,
    private alertService: AlertService,
    private beeService: BeeService,
  ) {
    this.runLoop();
  }

  runLoop() {
    System.forever(
      async () => {
        await this.topUpStamps();
        await this.createStamps();
        await this.diluteStamps();
      },
      Dates.seconds(5),
      (m, e) => {
        this.logger.error(e, m);
      },
    );
  }

  async createStamps() {
    const createJobs = await getPostageCreationQueueRows();
    for (const createJob of createJobs) {
      try {
        const { postageBatchId, beeId } = await this.beeService.createPostageBatch(
          createJob.amount.toString(),
          createJob.depth,
        );
        await updateOrganizationsRow(createJob.organizationId, { postageBatchId, beeId });
        await runQuery('DELETE FROM postageCreationQueue WHERE id = ?', createJob.id);
      } catch (error) {
        const message = `Create job: Failed to create postage batch for organization ${createJob.organizationId}`;
        this.logger.error(error, message);
        this.alertService.sendAlert(message);
      }
    }
  }

  async topUpStamps() {
    const topUpJobs = await getPostageTopUpQueueRows();
    for (const topUpJob of topUpJobs) {
      try {
        const org = await getOnlyOrganizationsRowOrThrow({ id: topUpJob.organizationId });
        await this.beeService.topUp(org.beeId!, topUpJob.postageBatchId, topUpJob.amount.toString());
        await runQuery('DELETE FROM postageTopUpQueue WHERE id = ?', topUpJob.id);
      } catch (error) {
        const message = `Top up job: Failed to top up postage batch for organization ${topUpJob.organizationId}`;
        this.logger.error(error, message);
        this.alertService.sendAlert(message);
      }
    }
  }

  async diluteStamps() {
    const diluteJobs = await getPostageDiluteQueueRows();
    for (const diluteJob of diluteJobs) {
      try {
        const org = await getOnlyOrganizationsRowOrThrow({ id: diluteJob.organizationId });
        await this.beeService.dilute(org.beeId!, diluteJob.postageBatchId, diluteJob.depth);
        await runQuery('DELETE FROM postageDiluteQueue WHERE id = ?', diluteJob.id);
      } catch (error) {
        const message = `Dilute job: Failed to dilute postage batch for organization ${diluteJob.organizationId}`;
        this.logger.error(error, message);
        this.alertService.sendAlert(message);
      }
    }
  }
}
