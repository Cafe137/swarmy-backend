import { Injectable } from '@nestjs/common';
import {
  getOnlyPaymentsRowOrThrow,
  getPaymentsRows,
  insertPaymentsRow,
  OrganizationsRowId,
  PlansRowId,
} from 'src/database/Schema';
import { AlertService } from '../alert/alert.service';

@Injectable()
export class PaymentService {
  constructor(private alertService: AlertService) {}

  async createPendingPayment(
    amount: number,
    currency: string,
    merchantTransactionId: string,
    organizationId: OrganizationsRowId,
    planId: PlansRowId,
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
    const rows = await getPaymentsRows({ merchantTransactionId });
    if (rows.length > 1) {
      this.alertService.sendAlert(`Duplicate payment row found for merchantTransactionId ${merchantTransactionId}`);
    }
    return getOnlyPaymentsRowOrThrow({ merchantTransactionId });
  }
}
