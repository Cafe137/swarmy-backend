import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Dates } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  getCryptoPaymentRemindersRows,
  getCryptoPaymentsRows,
  getOnlyOrganizationsRowOrThrow,
  getPlansRows,
  getUsersRows,
} from 'src/DatabaseExtra';
import { EmailService } from '../email/email.service';
import { CryptoPaymentService } from './crypto-payment.service';

@Injectable()
export class CryptoPaymentScheduledService {
  constructor(
    @InjectPinoLogger(CryptoPaymentScheduledService.name)
    private readonly logger: PinoLogger,
    private readonly cryptoPaymentService: CryptoPaymentService,
    private readonly emailService: EmailService,
  ) {}

  @Interval(Dates.seconds(30))
  async checkForPayment() {
    const pendingCryptoPayments = await getCryptoPaymentsRows({ status: 'PENDING' });
    for (const payment of pendingCryptoPayments) {
      await this.cryptoPaymentService.checkPayment(payment);
    }
  }

  @Interval(Dates.hours(1))
  async checkForReminders() {
    const plans = await getPlansRows({ status: 'ACTIVE', paymentType: 'CRYPTO' });
    for (const plan of plans) {
      if (!plan.paidUntil) {
        continue;
      }
      const delta = plan.paidUntil.getTime() - Date.now();
      if (delta < Dates.days(7)) {
        const lastReminder = await getCryptoPaymentRemindersRows(
          { planId: plan.id },
          {
            order: { column: 'createdAt', direction: 'DESC' },
            limit: 1,
          },
        );
        if (lastReminder.length > 0) {
          const lastReminderDate = lastReminder[0].createdAt.getTime();
          if (Date.now() - lastReminderDate < Dates.days(5)) {
            continue;
          }
        }
        const organization = await getOnlyOrganizationsRowOrThrow({ id: plan.organizationId });
        const { redirectUrl } = await this.cryptoPaymentService.createContinousPayment(organization.id, plan.id);
        const users = await getUsersRows({ organizationId: organization.id });
        for (const user of users) {
          this.logger.info(`Sending reminder to ${user.email} for plan ${plan.id}`);
          await this.emailService.sendCryptoPaymentReminder(user.email, redirectUrl);
        }
      }
    }
  }
}
