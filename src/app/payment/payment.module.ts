import { Module } from '@nestjs/common';
import { PaymentNotificationService } from './payment-notification.service';
import { PaymentService } from './payment.service';

@Module({
  controllers: [],
  providers: [PaymentService, PaymentNotificationService],
  exports: [PaymentService, PaymentNotificationService],
  imports: [],
})
export class PaymentModule {}
