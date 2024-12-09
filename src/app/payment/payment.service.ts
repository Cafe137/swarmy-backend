import { Injectable } from '@nestjs/common';
import { getOnlyPaymentsRowOrThrow, insertPaymentsRow } from 'src/DatabaseExtra';

@Injectable()
export class PaymentService {
  constructor() {}

  async createPendingPayment(
    amount: number,
    currency: string,
    merchantTransactionId: string,
    organizationId: number,
    planId: number,
  ) {
    const id = await insertPaymentsRow({
      merchantTransactionId,
      organizationId,
      planId,
      amount,
      currency,
      status: 'PENDING',
    });
    return getOnlyPaymentsRowOrThrow({ id });
  }

  async getPaymentByMerchantTransactionId(merchantTransactionId: string) {
    return getOnlyPaymentsRowOrThrow({ merchantTransactionId });
  }
}
