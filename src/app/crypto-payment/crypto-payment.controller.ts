import { Body, Controller, Get, Param, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'cafe-utility';
import { createHmac } from 'crypto';
import { Request } from 'express';
import { OrganizationsRow, PlansRowId } from 'src/database/Schema';
import { Public } from '../auth/public.decorator';
import { OrganizationInContext } from '../organization/organization.decorator';
import { CryptoPaymentService } from './crypto-payment.service';

@Controller()
export class CryptoPaymentController {
  private readonly coinbaseWebhookSecret: string;
  constructor(
    private readonly cryptoPaymentService: CryptoPaymentService,
    configService: ConfigService,
  ) {
    this.coinbaseWebhookSecret = Types.asString(configService.get<string>('COINBASE_WEBHOOK_SECRET'), {
      name: 'COINBASE_WEBHOOK_SECRET',
    });
  }

  @Get('/crypto-payments')
  getCryptoPaymentsForOrganization(@OrganizationInContext() organization: OrganizationsRow) {
    return this.cryptoPaymentService.getPaymentsForOrganization(organization.id);
  }

  @Post('/crypto-payments/:planId')
  initiatieCryptoPayment(@OrganizationInContext() organization: OrganizationsRow, @Param('planId') planId: number) {
    return this.cryptoPaymentService.initiatePaymentForPlan(organization.id, planId as PlansRowId);
  }

  @Public()
  @Post('/coinbase')
  handleCoinbaseWebhook(@Req() request: RawBodyRequest<Request>, @Body() body: any) {
    if (!request.rawBody) {
      throw Error('Missing raw body');
    }

    const remoteSignature = request.get('x-cc-webhook-signature');
    const localSignature = createHmac('sha256', this.coinbaseWebhookSecret).update(request.rawBody).digest('hex');
    if (remoteSignature !== localSignature) {
      throw Error('Invalid signature');
    }

    Types.asObject(body, { name: 'body' });
    const event = Types.asObject(body.event, { name: 'event' });
    this.cryptoPaymentService.handleWebhook(event);
  }
}
