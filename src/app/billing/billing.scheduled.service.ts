import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Dates } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  getPlansRows,
  getPostageTopUpQueueRows,
  insertPostageTopUpQueueRow,
  PlansRow,
  updateOrganizationsRow,
  updatePlansRow,
} from 'src/DatabaseExtra';
import { AlertService } from '../alert/alert.service';
import { BeeService } from '../bee/bee.service';
import { OrganizationService } from '../organization/organization.service';

@Injectable()
export class BillingScheduledService {
  constructor(
    @InjectPinoLogger(BillingScheduledService.name)
    private readonly logger: PinoLogger,
    private alertService: AlertService,
    private beeService: BeeService,
    private organizationService: OrganizationService,
  ) {}

  @Interval(Dates.minutes(5))
  async checkPlansForCancellation() {
    const plans = await getPlansRows({ status: 'ACTIVE' });
    for (const plan of plans) {
      if (plan.paidUntil && plan.paidUntil.getTime() < Date.now()) {
        this.logger.info(`Cancelling plan ${plan.id}`);
        await this.cancelPlan(plan);
      }
    }
  }

  @Interval(Dates.minutes(5))
  async checkPlansForTopUp() {
    const plans = await getPlansRows({ status: 'ACTIVE' });
    for (const plan of plans) {
      const organization = await this.organizationService.getOrganization(plan.organizationId);
      if (!organization.postageBatchId) {
        const message = `Organization ${organization.id} has no postageBatchId, but has an active plan ${plan.id}`;
        this.logger.error(message);
        this.alertService.sendAlert(message);
        continue;
      }
      const { batchTTL } = await this.beeService.getPostageBatch(organization.postageBatchId);
      if (batchTTL / 1000 < Dates.days(3)) {
        const existingJobs = await getPostageTopUpQueueRows({ postageBatchId: organization.postageBatchId });
        if (existingJobs.length > 0) {
          continue;
        }
        await insertPostageTopUpQueueRow({
          organizationId: organization.id,
          postageBatchId: organization.postageBatchId,
          amount: (await this.beeService.getAmountPerDay()) * 3,
        });
      }
    }
  }

  async cancelPlan(plan: PlansRow) {
    const organization = await this.organizationService.getOrganization(plan.organizationId);
    this.logger.info(`Cancelling plan ${plan.id} for organization ${organization.id}`);
    await updatePlansRow(plan.id, { status: 'CANCELLED' });
    this.logger.info(`Removing postageBatchId ${organization.postageBatchId} from organization ${organization.id}`);
    await updateOrganizationsRow(organization.id, { postageBatchId: null });
  }
}
