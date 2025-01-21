import { Injectable } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { ConfigService } from '@nestjs/config';
import { Strings, Types } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { OrganizationsRowId, PlansRowId } from 'src/DatabaseExtra';
import Stripe from 'stripe';
import { AlertService } from '../alert/alert.service';
import { PaymentNotificationService } from '../payment/payment-notification.service';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class StripeService {
  private stripeClient: Stripe;
  private readonly frontendUrl: string;
  private readonly webhookSecret: string;
  private readonly productId: string;

  constructor(
    @InjectPinoLogger(StripeService.name)
    private readonly logger: PinoLogger,
    configService: ConfigService,
    private alertService: AlertService,
    private paymentService: PaymentService,
    private paymentNotificationService: PaymentNotificationService,
  ) {
    this.frontendUrl = Types.asString(configService.get<string>('FRONTEND_URL'), { name: 'FRONTEND_URL' });
    this.webhookSecret = Types.asString(configService.get<string>('STRIPE_WEBHOOK_SECRET'), {
      name: 'STRIPE_WEBHOOK_SECRET',
    });
    this.productId = Types.asString(configService.get<string>('STRIPE_PRODUCT_ID'), { name: 'STRIPE_PRODUCT_ID' });
    const apiKey = Types.asString(configService.get<string>('STRIPE_API_KEY'), { name: 'STRIPE_API_KEY' });
    this.stripeClient = new Stripe(apiKey);
  }

  async createStripeCustomer(email: string) {
    const customer = await this.stripeClient.customers.create({
      email: Strings.normalizeEmail(email),
    });

    return customer.id;
  }

  async createPortalSession(stripeIdentifier: string) {
    const session = await this.stripeClient.billingPortal.sessions.create({
      customer: stripeIdentifier,
      return_url: `${this.frontendUrl}/app/billing`,
    });
    if (!session.url) {
      throw Error('No session URL');
    }
    return session.url;
  }

  async initPayment(
    organizationId: OrganizationsRowId,
    planId: PlansRowId,
    stripeIdentifier: string,
    amount: number,
    currency: string,
  ) {
    const merchantTransactionId = randomStringGenerator();
    await this.paymentService.createPendingPayment(amount, currency, merchantTransactionId, organizationId, planId);

    const session = await this.stripeClient.checkout.sessions.create({
      billing_address_collection: 'auto',
      customer: stripeIdentifier,
      client_reference_id: merchantTransactionId,
      line_items: [
        {
          price_data: {
            unit_amount: amount,
            currency: currency,
            product: this.productId,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          client_reference_id: merchantTransactionId,
        },
      },
      mode: 'subscription',
      success_url: `${this.frontendUrl}/app/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.frontendUrl}/app/billing?canceled=true`,
    });

    return {
      redirectUrl: session.url,
    };
  }

  async cancelPreviousSubscriptions(stripeCustomer: string) {
    const subscriptions = await this.stripeClient.subscriptions.list({
      customer: stripeCustomer,
    });
    subscriptions.data.sort((a, b) => b.created - a.created);
    for (const subscription of subscriptions.data.slice(1)) {
      if (subscription.status !== 'canceled') {
        try {
          await this.stripeClient.subscriptions.cancel(subscription.id);
        } catch (error) {
          const message = `Failed to cancel subscription ${subscription.id} for customer ${stripeCustomer}`;
          this.logger.error(error, message);
          this.alertService.sendAlert(message);
        }
      }
    }
  }

  verifyAndParseEvent(requestBody: any, signature: string) {
    //todo handle exception properly
    const event = this.stripeClient.webhooks.constructEvent(requestBody, signature, this.webhookSecret);
    return event;
  }

  async handleNotification(requestBody: any, signature: string) {
    const event = this.verifyAndParseEvent(requestBody, signature);
    await this.paymentNotificationService.saveNotification(event.type, event);

    return event;
  }
}
