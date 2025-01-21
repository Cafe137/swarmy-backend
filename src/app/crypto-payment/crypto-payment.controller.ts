import { Controller, Get, Post } from '@nestjs/common';
import { OrganizationsRow, PlansRowId } from 'src/DatabaseExtra';
import { OrganizationInContext } from '../organization/organization.decorator';
import { CryptoPaymentService } from './crypto-payment.service';

@Controller()
export class CryptoPaymentController {
  constructor(private readonly cryptoPaymentService: CryptoPaymentService) {}

  @Get('/crypto-payments')
  getCryptoPaymentsForOrganization(@OrganizationInContext() organization: OrganizationsRow) {
    return this.cryptoPaymentService.getPaymentsForOrganization(organization.id);
  }

  @Post('/crypto-payments/:plan')
  initiatieCryptoPayment(@OrganizationInContext() organization: OrganizationsRow, planId: number) {
    return this.cryptoPaymentService.initiatePaymentForPlan(organization.id, planId as PlansRowId);
  }
}
