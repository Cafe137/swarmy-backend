import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Strings } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  getOnlyPlansRowOrThrow,
  insertPaymentsRow,
  insertPlansRow,
  OrganizationsRow,
  updatePaymentsRow,
  UsersRow,
} from 'src/DatabaseExtra';
import Stripe from 'stripe';
import { AlertService } from '../alert/alert.service';
import { BeeService } from '../bee/bee.service';
import { OrganizationService } from '../organization/organization.service';
import { PaymentService } from '../payment/payment.service';
import { PlanService } from '../plan/plan.service';
import { subscriptionConfig } from '../plan/subscriptions';
import { StripeService } from '../stripe/stripe.service';
import { StartSubscriptionDto } from './start-subscription.dto';

@Injectable()
export class BillingService {
  constructor(
    @InjectPinoLogger(BillingService.name)
    private readonly logger: PinoLogger,
    private alertService: AlertService,
    private planService: PlanService,
    private stripeService: StripeService,
    private paymentService: PaymentService,
    private beeService: BeeService,
    private organizationService: OrganizationService,
  ) {}

  async handleStripeNotification(rawRequestBody: Buffer, signature: string) {
    const event = await this.stripeService.handleNotification(rawRequestBody, signature);

    switch (event.type) {
      // successful payment and start of a subscription
      case 'checkout.session.completed':
        const object = event.data.object as any;
        const merchantTransactionId = object.client_reference_id;
        const stripeCustomerId = object.customer;
        await this.handleCheckoutSessionCompleted(merchantTransactionId, stripeCustomerId);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
    }
  }

  getPortalSessionUrl(organization: OrganizationsRow) {
    return this.stripeService.createPortalSession(organization.stripeIdentifier);
  }

  async initSubscriptionProcess(user: UsersRow, payload: StartSubscriptionDto) {
    //todo validate

    const selectedStorageOption = subscriptionConfig.storageCapacity.options.find(
      (o) => o.size === payload.uploadSizeLimit,
    );
    const selectedBandwidthOption = subscriptionConfig.bandwidth.options.find(
      (o) => o.size === payload.downloadSizeLimit,
    );

    if (!selectedStorageOption || !selectedBandwidthOption) {
      const message = `Invalid pricing provided ${Strings.represent(payload)}`;
      this.alertService.sendAlert(message);
      this.logger.error(message);
      throw new BadRequestException(message);
    }

    const storageCapacity = selectedStorageOption.size;
    const bandwidth = selectedBandwidthOption.size;
    const storageAmount = storageCapacity * subscriptionConfig.storageCapacity.pricePerGb;
    const bandwidthAmount = bandwidth * subscriptionConfig.bandwidth.pricePerGb;

    const total = storageAmount + bandwidthAmount;
    const totalCents = Math.round((total + Number.EPSILON) * 100);

    const planId = await insertPlansRow({
      organizationId: user.organizationId,
      amount: totalCents,
      currency: subscriptionConfig.currency,
      frequency: 'MONTH',
      uploadSizeLimit: storageCapacity * 1024 * 1024 * 1024,
      downloadSizeLimit: bandwidth * 1024 * 1024 * 1024,
      downloadCountLimit: 100_000,
      uploadCountLimit: 100_000,
      status: 'PENDING_PAYMENT',
    });
    const plan = await getOnlyPlansRowOrThrow({ id: planId });

    this.logger.info(`Initializing payment. User: ${user.id} Amount: ${plan.amount} ${plan.currency}`);
    const organization = await this.organizationService.getOrganization(user.organizationId);
    const result = this.stripeService.initPayment(
      user.organizationId,
      plan.id,
      organization.stripeIdentifier,
      totalCents,
      plan.currency,
    );

    return result;
  }

  private async handleCheckoutSessionCompleted(merchantTransactionId: string, stripeCustomerId: string) {
    this.logger.info(
      `Processing checkoutSessionCompleted - merchantTransactionId: ${merchantTransactionId}, stripeCustomerId: ${stripeCustomerId}`,
    );

    const payment = await this.paymentService.getPaymentByMerchantTransactionId(merchantTransactionId);
    if (!payment) {
      throw new BadRequestException(`No payment found with id ${merchantTransactionId}`);
    }

    const organization = await this.organizationService.getOrganization(payment.organizationId);
    const planToActivate = await this.planService.getPlanById(organization.id, payment.planId);

    await this.planService.activatePlan(organization.id, planToActivate.id);
    await updatePaymentsRow(payment.id, { status: 'SUCCESS' });
  }

  private async handleInvoicePaid(object: Stripe.Invoice) {
    const merchantTransactionId = object?.subscription_details?.metadata?.client_reference_id;
    if (!merchantTransactionId) {
      const message = 'No merchantTransactionId found in invoicePaid event.';
      this.alertService.sendAlert(message);
      throw new InternalServerErrorException(message);
    }

    this.logger.info(`Processing invoicePaid for merchantTransactionId: ${merchantTransactionId}`);
    const payment = await this.paymentService.getPaymentByMerchantTransactionId(merchantTransactionId);

    if (object.billing_reason === 'subscription_create') {
      this.logger.info(`Billing reason is 'subscription_create', skipping processing event.`);
    } else {
      // recurring payment, there must be already a plan at this point
      this.logger.debug(`Creating successful payment for plan: ${payment.planId}`);
      await insertPaymentsRow({
        amount: object.amount_paid,
        currency: object.currency,
        planId: payment.planId,
        organizationId: payment.organizationId,
        status: 'SUCCESS',
        merchantTransactionId,
      });
      await this.planService.applyRecurringPayment(payment.organizationId);
    }
  }
}
