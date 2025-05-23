import { Duration, Size, Utils } from '@ethersphere/bee-js';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Dates } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  getOnlyOrganizationsRowOrThrow,
  getOnlyPlansRowOrNull,
  getOnlyPlansRowOrThrow,
  getPostageCreationQueueRows,
  insertPostageCreationQueueRow,
  insertPostageDiluteQueueRow,
  OrganizationsRow,
  OrganizationsRowId,
  PlansRow,
  PlansRowId,
  updatePlansRow,
} from 'src/database/Schema';
import { AlertService } from '../alert/alert.service';
import { BeeService } from '../bee/bee.service';
import { StripeService } from '../stripe/stripe.service';
import { UsageMetricsService } from '../usage-metrics/usage-metrics.service';

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
      this.safelyQueueCreation(organization, plan);
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

  async safelyQueueCreation(organization: OrganizationsRow, plan: PlansRow) {
    const existingCreation = await getPostageCreationQueueRows({ organizationId: organization.id });
    if (existingCreation.length > 0) {
      return;
    }
    const requestedGbs = plan.uploadSizeLimit / 1024 / 1024 / 1024;
    const blockPrice = await this.beeService.getDataPricePerBlock();
    const amount = Utils.getAmountForDuration(Duration.fromDays(DAYS_TO_PURCHASE_POSTAGE_BATCH), blockPrice, 5);
    const depth = Utils.getDepthForSize(Size.fromGigabytes(requestedGbs));
    await insertPostageCreationQueueRow({
      organizationId: organization.id,
      amount: Number(amount),
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
    const depth = Utils.getDepthForSize(Size.fromGigabytes(requestedGbs));
    const postageBatch = await this.beeService.getPostageBatch(organization.beeId, organization.postageBatchId);
    if (depth > postageBatch.depth) {
      await insertPostageDiluteQueueRow({
        organizationId: organization.id,
        postageBatchId: organization.postageBatchId,
        depth,
      });
    }
  }
}
