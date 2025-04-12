import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Dates } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  getCryptoPaymentRemindersRows,
  getOnlyOrganizationsRowOrThrow,
  getPlansRows,
  getUsersRows,
  insertCryptoPaymentRemindersRow,
} from 'src/database/Schema';
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
        await insertCryptoPaymentRemindersRow({ planId: plan.id, organizationId: organization.id });
        const users = await getUsersRows({ organizationId: organization.id });
        for (const user of users) {
          this.logger.info(`Sending reminder to ${user.email} for plan ${plan.id}`);
          await this.emailService.sendCryptoPaymentReminder(user.email, redirectUrl);
        }
      }
    }
  }
}
