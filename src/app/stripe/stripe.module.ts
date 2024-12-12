import { Module } from '@nestjs/common';
import { PaymentModule } from '../payment/payment.module';
import { StripeService } from '../stripe/stripe.service';

@Module({
  controllers: [],
  providers: [StripeService],
  exports: [StripeService],
  imports: [PaymentModule],
})
export class StripeModule {}
