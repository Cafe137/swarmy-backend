import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Dates } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { getPlansRows, PlansRow, updateOrganizationsRow, updatePlansRow } from 'src/DatabaseExtra';
import { OrganizationService } from '../organization/organization.service';
import { PlanService } from '../plan/plan.service';

@Injectable()
export class BillingScheduledService {
  constructor(
    @InjectPinoLogger(BillingScheduledService.name)
    private readonly logger: PinoLogger,
    private planService: PlanService,
    private organizationService: OrganizationService,
  ) {}

  @Interval(Dates.minutes(5))
  async checkPlansForCancellation() {
    const plans = await getPlansRows({ status: 'ACTIVE' });
    for (const plan of plans) {
      if (plan.cancelAt && plan.cancelAt.getTime() < Date.now()) {
        this.logger.info(`Cancelling plan ${plan.id}`);
        await this.cancelPlan(plan);
      }
    }
  }

  async cancelPlan(plan: PlansRow) {
    const organization = await this.organizationService.getOrganization(plan.organizationId);
    this.logger.info(`Cancelling plan ${plan.id} for organization ${organization.id}`);
    await updatePlansRow(plan.id, { status: 'CANCELLED' });
    this.logger.info(`Removing postageBatchId ${organization.postageBatchId} from organization ${organization.id}`);
    await updateOrganizationsRow(organization.id, { postageBatchId: null, postageBatchStatus: 'REMOVED' });
  }
}
