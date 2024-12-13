import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Dates } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  getOnlyOrganizationsRowOrThrow,
  getOnlyPlansRowOrNull,
  getOnlyPlansRowOrThrow,
  insertPostageCreationQueueRow,
  insertPostageDiluteQueueRow,
  OrganizationsRow,
  OrganizationsRowId,
  PlansRow,
  PlansRowId,
  updatePlansRow,
} from 'src/DatabaseExtra';
import { AlertService } from '../alert/alert.service';
import { BeeService } from '../bee/bee.service';
import { StripeService } from '../stripe/stripe.service';
import { UsageMetricsService } from '../usage-metrics/usage-metrics.service';
import { getDepthForRequestedStorage } from './subscriptions';

const DAYS_TO_PURCHASE_POSTAGE_BATCH = 30;

@Injectable()
export class PlanService {
  constructor(
    @InjectPinoLogger(PlanService.name)
    private readonly logger: PinoLogger,
    private alertService: AlertService,
    private usageMetricsService: UsageMetricsService,
    private beeService: BeeService,
    private stripeService: StripeService,
  ) {}

  async getActivePlanForOrganization(organizationId: OrganizationsRowId): Promise<PlansRow | null> {
    return getOnlyPlansRowOrNull({ organizationId, status: 'ACTIVE' });
  }

  async activatePlan(organizationId: OrganizationsRowId, planId: PlansRowId): Promise<void> {
    const planToActivate = await getOnlyPlansRowOrThrow({ id: planId });
    if (planToActivate.status === 'ACTIVE') {
      const message = `Plan ${planToActivate.id} to activate must be PENDING_PAYMENT, but it's ${planToActivate.status}`;
      this.alertService.sendAlert(message);
      this.logger.error(message);
      throw new InternalServerErrorException(message);
    }

    const existingActivePlan = await this.getActivePlanForOrganization(organizationId);
    if (existingActivePlan) {
      await this.cancelExistingPlanForUpgrade(existingActivePlan, planToActivate);
    }

    const organization = await getOnlyOrganizationsRowOrThrow({ id: organizationId });
    await this.stripeService.cancelPreviousSubscriptions(organization.stripeIdentifier);

    const paidUntil = new Date(Date.now() + Dates.days(31));
    await updatePlansRow(planId, { status: 'ACTIVE', paidUntil });
    const plan = await getOnlyPlansRowOrThrow({ id: planId });
    await this.usageMetricsService.upgradeCurrentMetrics(organizationId, plan.uploadSizeLimit, plan.downloadSizeLimit);
    this.logger.info(`Plan ${planId} activated, proceeding to top up or buy postage batch`);

    if (existingActivePlan) {
      this.queueDilute(organization, plan);
    } else {
      await this.usageMetricsService.resetForOrganization(organizationId);
      this.queueCreation(organization, plan);
    }
  }

  async applyRecurringPayment(organizationId: OrganizationsRowId) {
    const activePlan = await this.getActivePlanForOrganization(organizationId);
    if (!activePlan) {
      const message = `Organization ${organizationId} has no active plan`;
      this.alertService.sendAlert(message);
      this.logger.error(message);
      throw new InternalServerErrorException(message);
    }
    const paidUntil = new Date(Date.now() + Dates.days(31));
    await updatePlansRow(activePlan.id, { paidUntil });
  }

  async cancelExistingPlanForUpgrade(planToCancel: PlansRow, planToUpgradeTo: PlansRow) {
    this.logger.info(`Cancelling plan ${planToCancel.id}, upgrading to ${planToUpgradeTo.id}`);
    updatePlansRow(planToCancel.id, {
      status: 'CANCELLED',
      statusReason: `UPGRADED_TO: ${planToUpgradeTo.id}`,
    });
  }

  async getPlanById(organizationId: OrganizationsRowId, planId: PlansRowId) {
    return getOnlyPlansRowOrThrow({ organizationId, id: planId });
  }

  private async queueCreation(organization: OrganizationsRow, plan: PlansRow) {
    const requestedGbs = plan.uploadSizeLimit / 1024 / 1024 / 1024;
    const amount = (await this.beeService.getAmountPerDay()) * DAYS_TO_PURCHASE_POSTAGE_BATCH;
    const depth = getDepthForRequestedStorage(requestedGbs);
    await insertPostageCreationQueueRow({
      organizationId: organization.id,
      amount,
      depth,
    });
  }

  private async queueDilute(organization: OrganizationsRow, plan: PlansRow) {
    if (!organization.postageBatchId) {
      const message = `Organization ${organization.id} has no postage batch id. Failing top up and dilute.`;
      this.logger.error(message);
      this.alertService.sendAlert(message);
      throw new InternalServerErrorException(message);
    }
    const requestedGbs = plan.uploadSizeLimit / 1024 / 1024 / 1024;
    const depth = getDepthForRequestedStorage(requestedGbs);
    await insertPostageDiluteQueueRow({
      organizationId: organization.id,
      postageBatchId: organization.postageBatchId,
      depth,
    });
  }
}
