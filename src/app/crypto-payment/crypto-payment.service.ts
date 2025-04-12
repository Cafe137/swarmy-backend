import { Injectable } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { FixedPointNumber, Types } from 'cafe-utility';
import {
  getCryptoPaymentsRows,
  getOnlyCryptoPaymentsRowOrThrow,
  getOnlyPlansRowOrThrow,
  insertCryptoPaymentsRow,
  OrganizationsRowId,
  PlansRowId,
  updateCryptoPaymentsRow,
} from 'src/database/Schema';
import { PlanService } from '../plan/plan.service';

@Injectable()
export class CryptoPaymentService {
  private readonly coinbaseApiKey: string;

  constructor(
    configService: ConfigService,
    private planService: PlanService,
  ) {
    this.coinbaseApiKey = Types.asString(configService.get<string>('COINBASE_API_KEY'), { name: 'COINBASE_API_KEY' });
  }

  public async getPaymentsForOrganization(organizationId: OrganizationsRowId) {
    return getCryptoPaymentsRows({ organizationId });
  }

  public async initiatePaymentForPlan(organizationId: OrganizationsRowId, planId: PlansRowId) {
    const plan = await getOnlyPlansRowOrThrow({ id: planId, status: 'PENDING_PAYMENT', organizationId });
    return this.createPendingPayment(organizationId, planId, plan.amount);
  }

  public async createContinousPayment(organizationId: OrganizationsRowId, planId: PlansRowId) {
    const plan = await getOnlyPlansRowOrThrow({ id: planId, status: 'ACTIVE', organizationId });
    return this.createPendingPayment(organizationId, plan.id, plan.amount);
  }

  private async createPendingPayment(organizationId: OrganizationsRowId, planId: PlansRowId, amount: number) {
    const merchantTransactionId = randomStringGenerator();
    const response = await axios
      .post(
        'https://api.commerce.coinbase.com/charges',
        {
          name: 'Swarmy Storage',
          local_price: { amount: new FixedPointNumber(amount, 2).toDecimalString(), currency: 'EUR' },
          pricing_type: 'fixed_price',
          metadata: { merchantTransactionId },
        },
        {
          headers: { 'X-CC-Api-Key': this.coinbaseApiKey, 'X-CC-Version': '2018-03-22' },
        },
      )
      .catch((error) => {
        console.log(error);
        throw Error('Failed to create payment');
      });
    const { id } = response.data.data;
    await insertCryptoPaymentsRow({
      merchantTransactionId,
      merchantUUID: id,
      redirectUrl: response.data.data.hosted_url,
      amount,
      currency: 'EUR',
      status: 'PENDING',
      organizationId,
      planId,
    });
    return { redirectUrl: response.data.data.hosted_url };
  }

  async handleWebhook(event: any) {
    const merchantUUID = event.data.id;
    const payment = await getOnlyCryptoPaymentsRowOrThrow({ merchantUUID });
    const timeline = event.data.timeline as {
      status: 'NEW' | 'SIGNED' | 'PENDING' | 'COMPLETED';
      time: string;
    }[];
    if (timeline.some((x) => x.status === 'COMPLETED')) {
      const plan = await getOnlyPlansRowOrThrow({ id: payment.planId });
      if (plan.status === 'ACTIVE') {
        await this.planService.applyRecurringPayment(payment.organizationId);
      } else if (plan.status === 'PENDING_PAYMENT') {
        await this.planService.activatePlan(payment.organizationId, payment.planId);
      }
      await updateCryptoPaymentsRow(payment.id, { status: 'SUCCESS' });
    }
  }
}
