import { Duration, Utils } from '@ethersphere/bee-js';
import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Dates } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  getPlansRows,
  getPostageTopUpQueueRows,
  insertPostageTopUpQueueRow,
  updateOrganizationsRow,
  updatePlansRow,
} from 'src/database/Schema';
import { AlertService } from '../alert/alert.service';
import { BeeService } from '../bee/bee.service';
import { OrganizationService } from '../organization/organization.service';
import { PlanService } from '../plan/plan.service';

@Injectable()
export class BillingScheduledService {
  constructor(
    @InjectPinoLogger(BillingScheduledService.name)
    private readonly logger: PinoLogger,
    private alertService: AlertService,
    private beeService: BeeService,
    private organizationService: OrganizationService,
    private planService: PlanService,
  ) {}

  @Interval(Dates.minutes(5))
  async maintainPlans() {
    const plans = await getPlansRows({ status: 'ACTIVE' });
    for (const plan of plans) {
      const organization = await this.organizationService.getOrganization(plan.organizationId);

      // cancel
      if (plan.paidUntil && plan.paidUntil.getTime() < Date.now()) {
        this.logger.info(`Cancelling plan ${plan.id} for organization ${organization.id}`);
        await updatePlansRow(plan.id, { status: 'CANCELLED' });
        this.logger.info(`Removing postageBatchId ${organization.postageBatchId} from organization ${organization.id}`);
        await updateOrganizationsRow(organization.id, { postageBatchId: null });
        continue;
      }

      // create
      if (!organization.postageBatchId) {
        const message = `Organization ${organization.id} has no postageBatchId, but has an active plan ${plan.id}`;
        this.logger.error(message);
        this.alertService.sendAlert(message);
        await this.planService.safelyQueueCreation(organization, plan);
        continue;
      }

      // extend
      const { duration } = await this.beeService.getPostageBatch(organization.beeId, organization.postageBatchId);
      if (duration.toDays() < 3) {
        const existingJobs = await getPostageTopUpQueueRows({ postageBatchId: organization.postageBatchId });
        if (existingJobs.length > 0) {
          continue;
        }
        const blockPrice = await this.beeService.getDataPricePerBlock();
        await insertPostageTopUpQueueRow({
          organizationId: organization.id,
          postageBatchId: organization.postageBatchId,
          amount: Number(Utils.getAmountForDuration(Duration.fromDays(3), blockPrice, 5)),
        });
      }
    }
  }
}
