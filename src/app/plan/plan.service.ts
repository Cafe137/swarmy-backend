import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Dates } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  getOnlyOrganizationsRowOrThrow,
  getOnlyPlansRowOrNull,
  getOnlyPlansRowOrThrow,
  OrganizationsRow,
  OrganizationsRowId,
  PlansRow,
  PlansRowId,
  updateOrganizationsRow,
  updatePlansRow,
} from 'src/DatabaseExtra';
import { AlertService } from '../alert/alert.service';
import { BeeService } from '../bee/bee.service';
import { UsageMetricsService } from '../usage-metrics/usage-metrics.service';
import { calculateDepthAndAmount } from './subscriptions';

const DAYS_TO_PURCHASE_POSTAGE_BATCH = 35;

@Injectable()
export class PlanService {
  constructor(
    @InjectPinoLogger(PlanService.name)
    private readonly logger: PinoLogger,
    private alertService: AlertService,
    private usageMetricsService: UsageMetricsService,
    private beeService: BeeService,
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

    const paidUntil = new Date(Date.now() + Dates.days(31));
    await updatePlansRow(planId, { status: 'ACTIVE', paidUntil });
    const plan = await getOnlyPlansRowOrThrow({ id: planId });
    await this.usageMetricsService.upgradeCurrentMetrics(organizationId, plan.uploadSizeLimit, plan.downloadSizeLimit);
    this.logger.info(`Plan ${planId} activated, proceeding to top up or buy postage batch`);

    const organization = await getOnlyOrganizationsRowOrThrow({ id: organizationId });
    if (existingActivePlan) {
      this.topUpAndDilute(organization, planToActivate);
    } else {
      await this.usageMetricsService.resetForOrganization(organizationId);
      this.buyPostageBatch(organization, plan);
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
    const organization = await getOnlyOrganizationsRowOrThrow({ id: activePlan.organizationId });
    this.topUp(organization, activePlan);
  }

  async cancelExistingPlanForUpgrade(planToCancel: PlansRow, planToUpgradeTo: PlansRow) {
    this.logger.info(`Cancelling plan ${planToCancel.id}, upgrading to ${planToUpgradeTo.id}`);
    updatePlansRow(planToCancel.id, {
      status: 'CANCELLED',
      statusReason: `UPGRADED_TO: ${planToUpgradeTo.id}`,
    });
  }

  async scheduleActivePlanForCancellation(organizationId: OrganizationsRowId) {
    const existingActivePlan = await this.getActivePlanForOrganization(organizationId);
    if (!existingActivePlan) {
      return;
    }
    await updatePlansRow(existingActivePlan.id, { cancelAt: existingActivePlan.paidUntil });
  }

  async getPlanById(organizationId: OrganizationsRowId, planId: PlansRowId) {
    return getOnlyPlansRowOrThrow({ organizationId, id: planId });
  }

  private async buyPostageBatch(organization: OrganizationsRow, plan: PlansRow) {
    const organizationId = organization.id;
    await updateOrganizationsRow(organizationId, { postageBatchStatus: 'CREATING' });
    try {
      const requestedGbs = plan.uploadSizeLimit / 1024 / 1024 / 1024;
      // top up for 35 days for tolerating late recurring payments
      const days = DAYS_TO_PURCHASE_POSTAGE_BATCH;
      const config = calculateDepthAndAmount(days, requestedGbs);
      this.logger.info(
        `Creating postage batch. Amount: ${config.amount}, depth: ${config.depth}, cost: BZZ ${config.bzzPrice}`,
      );
      const batchId = await this.beeService.createPostageBatch(config.amount.toFixed(0), config.depth);
      this.logger.info(`Updating postback batch of organization ${organizationId} to ${batchId}`);
      await updateOrganizationsRow(organizationId, { postageBatchId: batchId, postageBatchStatus: 'CREATED' });
    } catch (e) {
      const message = `Failed to buy postage batch for organization ${organizationId}`;
      this.alertService.sendAlert(message);
      this.logger.error(e, message);
      await updateOrganizationsRow(organizationId, { postageBatchStatus: 'FAILED_TO_CREATE' });
    }
  }

  private async topUp(organization: OrganizationsRow, plan: PlansRow) {
    const requestedGbs = plan.uploadSizeLimit / 1024 / 1024 / 1024;
    const days = 31;
    const config = calculateDepthAndAmount(days, requestedGbs);
    const amount = config.amount.toFixed(0);
    await this.tryTopUp(organization, amount, days);
  }

  private async tryTopUp(organization: OrganizationsRow, amount: string, days: number) {
    if (!organization.postageBatchId) {
      const message = `Organization ${organization.id} has no postage batch id. Failing top up.`;
      this.alertService.sendAlert(message);
      this.logger.error(message);
      throw new InternalServerErrorException(message);
    }
    try {
      this.logger.info(`Performing topUp on ${organization.postageBatchId} with amount: ${amount}. (days: ${days})`);
      await this.beeService.topUp(organization.postageBatchId, amount);
      this.logger.info(
        `TopUp completed successfully on ${organization.postageBatchId} with amount: ${amount}. (days: ${days})`,
      );
      return true;
    } catch (e) {
      const message = `TopUp operation failed. Org: ${organization.id}`;
      this.alertService.sendAlert(message, e);
      this.logger.error(e, message);
      await updateOrganizationsRow(organization.id, { postageBatchStatus: 'FAILED_TO_TOP_UP' });
      return false;
    }
  }

  private async topUpAndDilute(organization: OrganizationsRow, plan: PlansRow) {
    if (!organization.postageBatchId) {
      const message = `Organization ${organization.id} has no postage batch id. Failing top up and dilute.`;
      this.alertService.sendAlert(message);
      throw new InternalServerErrorException(message);
    }
    //todo calculate minimum required top up amount
    //todo check if dilute is needed
    //todo store amount and depth?

    const requestedGbs = plan.uploadSizeLimit / 1024 / 1024 / 1024;
    const days = 31;
    const config = calculateDepthAndAmount(days, requestedGbs);
    const amount = config.amount.toFixed(0);
    const success: boolean = await this.tryTopUp(organization, amount, days);
    if (!success) {
      const message = `TopUp operation failed. Skipping diluting. Org: ${organization.id}`;
      this.alertService.sendAlert(message);
      this.logger.error(message);
      return;
    }
    try {
      await this.beeService.dilute(organization.postageBatchId, config.depth);
      this.logger.info(`Dilute successful dilute on ${organization.postageBatchId} with depth: ${config.depth}`);
    } catch (e) {
      const message = `Dilute operation failed. Org: ${organization.id}`;
      this.alertService.sendAlert(message, e);
      this.logger.error(e, message);
      await updateOrganizationsRow(organization.id, { postageBatchStatus: 'FAILED_TO_DILUTE' });
    }
  }
}
