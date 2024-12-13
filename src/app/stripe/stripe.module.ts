import { Module } from '@nestjs/common';
import { AlertModule } from '../alert/alert.module';
import { PaymentModule } from '../payment/payment.module';
import { StripeService } from '../stripe/stripe.service';

@Module({
  controllers: [],
  providers: [StripeService],
  exports: [StripeService],
  imports: [AlertModule, PaymentModule],
})
export class StripeModule {}
