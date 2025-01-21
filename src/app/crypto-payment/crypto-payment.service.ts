import { Injectable } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Types } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  CryptoPaymentsRow,
  getCryptoPaymentsRows,
  getOnlyPlansRowOrThrow,
  insertCryptoPaymentsRow,
  OrganizationsRowId,
  PlansRowId,
} from 'src/DatabaseExtra';

@Injectable()
export class CryptoPaymentService {
  private readonly coinbaseApiKey: string;

  constructor(
    @InjectPinoLogger(CryptoPaymentService.name)
    private readonly logger: PinoLogger,
    configService: ConfigService,
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

  public async checkPayment(payment: CryptoPaymentsRow) {
    const response = await axios.get(`https://api.commerce.coinbase.com/charges/${payment.merchantUUID}`, {
      headers: { 'X-CC-Api-Key': this.coinbaseApiKey },
    });
    console.log(response.data);
  }

  public async createContinousPayment(organizationId: OrganizationsRowId, planId: PlansRowId) {
    const plan = await getOnlyPlansRowOrThrow({ id: planId, status: 'ACTIVE', organizationId });
    return this.createPendingPayment(organizationId, plan.id, plan.amount);
  }

  private async createPendingPayment(organizationId: OrganizationsRowId, planId: PlansRowId, amount: number) {
    const merchantTransactionId = randomStringGenerator();
    const response = await axios.post('https://api.commerce.coinbase.com/charges', {
      headers: { 'X-CC-Api-Key': this.coinbaseApiKey },
      data: {
        name: 'Swarmy Storage',
        local_price: { amount, currency: 'EUR' },
        pricing_type: 'fixed_price',
        metadata: { merchantTransactionId },
      },
    });
    console.log(response.data);
    const { id } = response.data;
    await insertCryptoPaymentsRow({
      merchantTransactionId,
      merchantUUID: id,
      redirectUrl: response.data.hosted_url,
      amount,
      currency: 'EUR',
      status: 'PENDING',
      organizationId,
      planId,
    });
    return response.data;
  }
}
